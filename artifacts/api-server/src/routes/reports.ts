import { Router } from "express";
import {
  db, transactionsTable, streamAccessTable, betsTable,
  usersTable, walletsTable, gamesTable, streamsTable,
} from "@workspace/db";
import { eq, sql, and, gte, lte, desc } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { sendMail } from "../lib/mailer";
import { logger } from "../lib/logger";

const router = Router();

function esc(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(...cells: (string | number | null | undefined)[]): string {
  return cells.map(esc).join(",");
}

function fmt(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleString("en-UG", { timeZone: "Africa/Kampala" });
}

export async function generateReportCsv(fromDate: Date, toDate: Date): Promise<string> {
  const sections: string[] = [];

  // ── SECTION 1: Summary ──────────────────────────────────
  const [[streamRev], [brokerageRev], [deposits], [withdrawals], [newUsers], [betsPlaced], [betsMatched], [betPool], [streamAccesses], [totalUsers]] = await Promise.all([
    db.select({ v: sql<number>`coalesce(sum(amount::numeric),0)` }).from(transactionsTable)
      .where(and(eq(transactionsTable.type, "stream_access"), gte(transactionsTable.createdAt, fromDate), lte(transactionsTable.createdAt, toDate))),
    db.select({ v: sql<number>`coalesce(sum(amount::numeric),0)` }).from(transactionsTable)
      .where(and(eq(transactionsTable.type, "brokerage_fee"), gte(transactionsTable.createdAt, fromDate), lte(transactionsTable.createdAt, toDate))),
    db.select({ v: sql<number>`coalesce(sum(amount::numeric),0)` }).from(transactionsTable)
      .where(and(eq(transactionsTable.type, "deposit"), eq(transactionsTable.status, "completed"), gte(transactionsTable.createdAt, fromDate), lte(transactionsTable.createdAt, toDate))),
    db.select({ v: sql<number>`coalesce(sum(amount::numeric),0)` }).from(transactionsTable)
      .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "completed"), gte(transactionsTable.createdAt, fromDate), lte(transactionsTable.createdAt, toDate))),
    db.select({ v: sql<number>`count(*)` }).from(usersTable)
      .where(and(gte(usersTable.createdAt, fromDate), lte(usersTable.createdAt, toDate))),
    db.select({ v: sql<number>`count(*)` }).from(betsTable)
      .where(and(gte(betsTable.createdAt, fromDate), lte(betsTable.createdAt, toDate))),
    db.select({ v: sql<number>`count(*)` }).from(betsTable)
      .where(and(eq(betsTable.status, "matched"), gte(betsTable.createdAt, fromDate), lte(betsTable.createdAt, toDate))),
    db.select({ v: sql<number>`coalesce(sum(stake::numeric),0)` }).from(betsTable)
      .where(and(gte(betsTable.createdAt, fromDate), lte(betsTable.createdAt, toDate))),
    db.select({ v: sql<number>`count(*)` }).from(streamAccessTable)
      .where(and(gte(streamAccessTable.createdAt, fromDate), lte(streamAccessTable.createdAt, toDate))),
    db.select({ v: sql<number>`count(*)` }).from(usersTable),
  ]);

  const streaming = parseFloat(streamRev.v as any) || 0;
  const brokerage = parseFloat(brokerageRev.v as any) || 0;
  const dep = parseFloat(deposits.v as any) || 0;
  const wit = parseFloat(withdrawals.v as any) || 0;

  sections.push(
    "ATA Sports Live — Platform Report",
    `Generated: ${fmt(new Date())} EAT`,
    `Period: ${fmt(fromDate)} to ${fmt(toDate)} EAT`,
    "",
    "=== FINANCIAL SUMMARY ===",
    row("Metric", "Value"),
    row("Streaming Revenue", `$${streaming.toFixed(2)}`),
    row("Brokerage Revenue", `$${brokerage.toFixed(2)}`),
    row("Total Revenue", `$${(streaming + brokerage).toFixed(2)}`),
    row("Total Deposits (completed)", `$${dep.toFixed(2)}`),
    row("Total Withdrawals (completed)", `$${wit.toFixed(2)}`),
    row("Net Wallet Flow", `$${(dep - wit).toFixed(2)}`),
    row("Stream Accesses", Number(streamAccesses.v)),
    row("Bets Placed", Number(betsPlaced.v)),
    row("Bets Matched", Number(betsMatched.v)),
    row("Total Bet Pool", `$${(parseFloat(betPool.v as any) || 0).toFixed(2)}`),
    row("New Users (period)", Number(newUsers.v)),
    row("Total Registered Users", Number(totalUsers.v)),
    "",
  );

  // ── SECTION 2: Transactions ─────────────────────────────
  const txRows = await db
    .select({
      id: transactionsTable.id,
      transactionId: transactionsTable.transactionId,
      createdAt: transactionsTable.createdAt,
      userEmail: usersTable.email,
      userName: usersTable.fullName,
      type: transactionsTable.type,
      amount: transactionsTable.amount,
      status: transactionsTable.status,
      method: transactionsTable.paymentMethod,
      reference: transactionsTable.reference,
      description: transactionsTable.description,
    })
    .from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .where(and(gte(transactionsTable.createdAt, fromDate), lte(transactionsTable.createdAt, toDate)))
    .orderBy(desc(transactionsTable.createdAt));

  sections.push(
    "=== TRANSACTIONS ===",
    row("ID", "Transaction ID", "Date (EAT)", "User Name", "User Email", "Type", "Amount (USD)", "Status", "Payment Method", "Reference", "Description"),
  );
  for (const t of txRows) {
    sections.push(row(t.id, t.transactionId, fmt(t.createdAt), t.userName, t.userEmail, t.type, t.amount, t.status, t.method, t.reference, t.description));
  }
  sections.push("");

  // ── SECTION 3: Bets ────────────────────────────────────
  const betRows = await db
    .select({
      id: betsTable.id,
      ticketId: betsTable.ticketId,
      createdAt: betsTable.createdAt,
      userEmail: usersTable.email,
      userName: usersTable.fullName,
      sport: gamesTable.sport,
      playerA: gamesTable.playerA,
      playerB: gamesTable.playerB,
      outcome: betsTable.outcome,
      stake: betsTable.stake,
      potentialReturn: betsTable.potentialReturn,
      status: betsTable.status,
      settledAt: betsTable.settledAt,
    })
    .from(betsTable)
    .leftJoin(usersTable, eq(betsTable.userId, usersTable.id))
    .leftJoin(gamesTable, eq(betsTable.gameId, gamesTable.id))
    .where(and(gte(betsTable.createdAt, fromDate), lte(betsTable.createdAt, toDate)))
    .orderBy(desc(betsTable.createdAt));

  sections.push(
    "=== BETS ===",
    row("ID", "Ticket ID", "Date (EAT)", "User Name", "User Email", "Sport", "Match", "Outcome", "Stake (USD)", "Potential Return (USD)", "Status", "Settled At (EAT)"),
  );
  for (const b of betRows) {
    sections.push(row(
      b.id, b.ticketId, fmt(b.createdAt), b.userName, b.userEmail,
      b.sport, `${b.playerA} vs ${b.playerB}`, b.outcome?.replace(/_/g, " "),
      b.stake, b.potentialReturn, b.status, fmt(b.settledAt),
    ));
  }
  sections.push("");

  // ── SECTION 4: Stream Accesses ─────────────────────────
  const accessRows = await db.execute(sql`
    SELECT sa.id, sa.created_at, u.full_name, u.email, s.title, s.sport, s.status, sa.expires_at
    FROM stream_access sa
    LEFT JOIN users u ON u.id = sa.user_id
    LEFT JOIN streams s ON s.id = sa.stream_id
    WHERE sa.created_at >= ${fromDate} AND sa.created_at <= ${toDate}
    ORDER BY sa.created_at DESC
  `);

  sections.push(
    "=== STREAM ACCESSES ===",
    row("ID", "Date (EAT)", "User Name", "User Email", "Stream Title", "Sport", "Stream Status", "Access Expires (EAT)"),
  );
  for (const a of accessRows.rows as any[]) {
    sections.push(row(a.id, fmt(a.created_at), a.full_name, a.email, a.title, a.sport, a.status, fmt(a.expires_at)));
  }
  sections.push("");

  // ── SECTION 5: User Wallet Balances Snapshot ───────────
  const walletRows = await db
    .select({
      userName: usersTable.fullName,
      userEmail: usersTable.email,
      phone: usersTable.phone,
      role: usersTable.role,
      status: usersTable.status,
      balance: walletsTable.balance,
      availableBalance: walletsTable.availableBalance,
      bonusBalance: walletsTable.bonusBalance,
      pendingBalance: walletsTable.pendingBalance,
      withdrawableBalance: walletsTable.withdrawableBalance,
      joinedAt: usersTable.createdAt,
    })
    .from(walletsTable)
    .leftJoin(usersTable, eq(walletsTable.userId, usersTable.id))
    .orderBy(desc(walletsTable.balance));

  sections.push(
    "=== USER WALLET BALANCES (current snapshot) ===",
    row("User Name", "Email", "Phone", "Role", "Status", "Balance (USD)", "Available (USD)", "Bonus (USD)", "Pending (USD)", "Withdrawable (USD)", "Joined (EAT)"),
  );
  for (const w of walletRows) {
    sections.push(row(w.userName, w.userEmail, w.phone, w.role, w.status, w.balance, w.availableBalance, w.bonusBalance, w.pendingBalance, w.withdrawableBalance, fmt(w.joinedAt)));
  }

  return sections.join("\n");
}

function getDateRange(period: string, from?: string, to?: string): { start: Date; end: Date; labels: string[] } {
  const now = new Date();
  const labels: string[] = [];
  let start: Date;
  let end = to ? new Date(to) : now;

  if (from) {
    start = new Date(from);
    return { start, end, labels: [] };
  }

  if (period === "daily") {
    start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      labels.push(d.toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric" }));
    }
  } else if (period === "weekly") {
    start = new Date(now);
    start.setDate(now.getDate() - 28);
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i * 7);
      labels.push(`Week of ${d.toLocaleDateString()}`);
    }
  } else if (period === "monthly") {
    start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.toLocaleString("default", { month: "short", year: "2-digit" }));
    }
  } else {
    start = new Date(now.getFullYear() - 3, 0, 1);
    for (let i = 3; i >= 0; i--) {
      labels.push((now.getFullYear() - i).toString());
    }
  }
  return { start, end, labels };
}

router.get("/streaming", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const period = (req.query.period as string) || "monthly";
  const { start, end, labels } = getDateRange(period, req.query.from as string, req.query.to as string);
  const [{ totalRevenue }] = await db.select({ totalRevenue: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "stream_access"), gte(transactionsTable.createdAt, start)));
  const [{ totalAccesses }] = await db.select({ totalAccesses: sql<number>`count(*)` }).from(streamAccessTable).where(gte(streamAccessTable.createdAt, start));
  const data = labels.map((label) => ({ label, value: 0, secondary: null }));
  res.json({ period, totalRevenue: parseFloat(totalRevenue as any) || 0, totalAccesses: Number(totalAccesses), data });
});

router.get("/betting", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const period = (req.query.period as string) || "monthly";
  const { start, end, labels } = getDateRange(period, req.query.from as string, req.query.to as string);
  const [{ brokerageRevenue }] = await db.select({ brokerageRevenue: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "brokerage_fee"), gte(transactionsTable.createdAt, start)));
  const [{ totalBetsPlaced }] = await db.select({ totalBetsPlaced: sql<number>`count(*)` }).from(betsTable).where(gte(betsTable.createdAt, start));
  const [{ totalBetsMatched }] = await db.select({ totalBetsMatched: sql<number>`count(*)` }).from(betsTable).where(and(eq(betsTable.status, "matched"), gte(betsTable.createdAt, start)));
  const [{ totalBetPool }] = await db.select({ totalBetPool: sql<number>`coalesce(sum(stake::numeric), 0)` }).from(betsTable).where(gte(betsTable.createdAt, start));
  const data = labels.map((label) => ({ label, value: 0, secondary: null }));
  res.json({ period, brokerageRevenue: parseFloat(brokerageRevenue as any) || 0, totalBetsPlaced: Number(totalBetsPlaced), totalBetsMatched: Number(totalBetsMatched), totalBetPool: parseFloat(totalBetPool as any) || 0, data });
});

router.get("/wallets", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const period = (req.query.period as string) || "monthly";
  const { start, end, labels } = getDateRange(period, req.query.from as string, req.query.to as string);
  const [{ totalDeposits }] = await db.select({ totalDeposits: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "deposit"), eq(transactionsTable.status, "completed"), gte(transactionsTable.createdAt, start)));
  const [{ totalWithdrawals }] = await db.select({ totalWithdrawals: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "completed"), gte(transactionsTable.createdAt, start)));
  const dep = parseFloat(totalDeposits as any) || 0;
  const wit = parseFloat(totalWithdrawals as any) || 0;
  const data = labels.map((label) => ({ label, value: 0, secondary: null }));
  res.json({ period, totalDeposits: dep, totalWithdrawals: wit, netFlow: dep - wit, data });
});

router.get("/revenue-breakdown", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const period = (req.query.period as string) || "monthly";
  const { start, end, labels } = getDateRange(period, req.query.from as string, req.query.to as string);
  const data = labels.map((label) => ({ label, streaming: 0, brokerage: 0 }));
  res.json({ period, data });
});

// ── CSV Export (download) ─────────────────────────────────────────
router.get("/export", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  try {
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fromDate = req.query.from ? new Date(req.query.from as string) : defaultFrom;
    const toDate = req.query.to ? new Date(req.query.to as string) : now;
    toDate.setHours(23, 59, 59, 999);

    const csv = await generateReportCsv(fromDate, toDate);
    const filename = `ata-report-${fromDate.toISOString().slice(0, 10)}-to-${toDate.toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    logger.error({ err }, "Failed to generate CSV export");
    res.status(500).json({ error: "Failed to generate report" });
  }
});

// ── Send report via email now ─────────────────────────────────────
router.post("/send", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  try {
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fromDate = req.body.from ? new Date(req.body.from as string) : defaultFrom;
    const toDate = req.body.to ? new Date(req.body.to as string) : now;
    toDate.setHours(23, 59, 59, 999);

    const csv = await generateReportCsv(fromDate, toDate);
    const filename = `ata-report-${fromDate.toISOString().slice(0, 10)}-to-${toDate.toISOString().slice(0, 10)}.csv`;

    const sent = await sendMail({
      to: "info@atasportslive.com",
      subject: `ATA Platform Report — ${fromDate.toISOString().slice(0, 10)} to ${toDate.toISOString().slice(0, 10)}`,
      html: `
        <h2>ATA Sports Live — Platform Report</h2>
        <p>Please find the platform report for the period <strong>${fromDate.toISOString().slice(0, 10)}</strong> to <strong>${toDate.toISOString().slice(0, 10)}</strong> attached as a CSV file.</p>
        <p>Requested by admin: <strong>${(req as any).user?.email ?? "admin"}</strong></p>
        <p style="color:#64748b;font-size:12px">This report was generated on-demand from the ATA admin panel.</p>
      `,
      attachments: [{ filename, content: csv, contentType: "text/csv" }] as any,
    });

    if (sent) {
      res.json({ ok: true, message: "Report sent to info@atasportslive.com" });
    } else {
      res.status(503).json({ ok: false, message: "SMTP not configured — report not sent. Use Export CSV to download instead." });
    }
  } catch (err) {
    logger.error({ err }, "Failed to send report email");
    res.status(500).json({ error: "Failed to send report" });
  }
});

export default router;
