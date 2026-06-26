import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import nodemailer from "nodemailer";
import { db, usersTable, walletsTable, transactionsTable, streamsTable, betsTable, notificationsTable, vouchersTable } from "@workspace/db";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { notify } from "../lib/notify";

const router = Router();

router.get("/stats", authMiddleware, requireRole("admin", "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const [{ totalUsers }] = await db.select({ totalUsers: sql<number>`count(*)` }).from(usersTable);
  const [{ activeUsers }] = await db.select({ activeUsers: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.status, "active"));
  const [{ totalWalletBalance }] = await db.select({ totalWalletBalance: sql<number>`sum(balance)` }).from(walletsTable);
  const [{ liveStreams }] = await db.select({ liveStreams: sql<number>`count(*)` }).from(streamsTable).where(eq(streamsTable.status, "live"));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [{ streamingRevenue }] = await db.select({ streamingRevenue: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(eq(transactionsTable.type, "stream_access"));
  const [{ brokerageRevenue }] = await db.select({ brokerageRevenue: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(eq(transactionsTable.type, "brokerage_fee"));
  const [{ openBets }] = await db.select({ openBets: sql<number>`count(*)` }).from(betsTable).where(eq(betsTable.status, "pending"));
  const [{ matchedBets }] = await db.select({ matchedBets: sql<number>`count(*)` }).from(betsTable).where(eq(betsTable.status, "matched"));
  const [{ pendingWithdrawals }] = await db.select({ pendingWithdrawals: sql<number>`count(*)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")));
  const [{ totalDepositsToday }] = await db.select({ totalDepositsToday: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "deposit"), eq(transactionsTable.status, "completed"), gte(transactionsTable.createdAt, today)));
  const [{ totalWithdrawalsToday }] = await db.select({ totalWithdrawalsToday: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "completed"), gte(transactionsTable.createdAt, today)));

  res.json({
    totalUsers: Number(totalUsers),
    activeUsers: Number(activeUsers),
    totalWalletBalance: parseFloat(totalWalletBalance as any) || 0,
    liveStreams: Number(liveStreams),
    totalRevenue: (parseFloat(streamingRevenue as any) || 0) + (parseFloat(brokerageRevenue as any) || 0),
    brokerageRevenue: parseFloat(brokerageRevenue as any) || 0,
    streamingRevenue: parseFloat(streamingRevenue as any) || 0,
    openBets: Number(openBets),
    matchedBets: Number(matchedBets),
    pendingWithdrawals: Number(pendingWithdrawals),
    totalDepositsToday: parseFloat(totalDepositsToday as any) || 0,
    totalWithdrawalsToday: parseFloat(totalWithdrawalsToday as any) || 0,
  });
});

router.get("/revenue", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const period = (req.query.period as string) || "monthly";

  const data = [];
  const now = new Date();

  if (period === "monthly") {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });

      const [{ streaming }] = await db.select({ streaming: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "stream_access"), gte(transactionsTable.createdAt, d), sql`${transactionsTable.createdAt} < ${end}`));
      const [{ brokerage }] = await db.select({ brokerage: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "brokerage_fee"), gte(transactionsTable.createdAt, d), sql`${transactionsTable.createdAt} < ${end}`));

      data.push({ label, streaming: parseFloat(streaming as any) || 0, brokerage: parseFloat(brokerage as any) || 0, total: (parseFloat(streaming as any) || 0) + (parseFloat(brokerage as any) || 0) });
    }
  } else if (period === "daily") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setDate(d.getDate() + 1);
      const label = d.toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric" });

      const [{ streaming }] = await db.select({ streaming: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "stream_access"), gte(transactionsTable.createdAt, d), sql`${transactionsTable.createdAt} < ${end}`));
      const [{ brokerage }] = await db.select({ brokerage: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "brokerage_fee"), gte(transactionsTable.createdAt, d), sql`${transactionsTable.createdAt} < ${end}`));

      data.push({ label, streaming: parseFloat(streaming as any) || 0, brokerage: parseFloat(brokerage as any) || 0, total: (parseFloat(streaming as any) || 0) + (parseFloat(brokerage as any) || 0) });
    }
  } else {
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now.getFullYear() - i, 0, 1);
      const end = new Date(now.getFullYear() - i + 1, 0, 1);
      const label = d.getFullYear().toString();

      const [{ streaming }] = await db.select({ streaming: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "stream_access"), gte(transactionsTable.createdAt, d), sql`${transactionsTable.createdAt} < ${end}`));
      const [{ brokerage }] = await db.select({ brokerage: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "brokerage_fee"), gte(transactionsTable.createdAt, d), sql`${transactionsTable.createdAt} < ${end}`));

      data.push({ label, streaming: parseFloat(streaming as any) || 0, brokerage: parseFloat(brokerage as any) || 0, total: (parseFloat(streaming as any) || 0) + (parseFloat(brokerage as any) || 0) });
    }
  }

  res.json({ period, data });
});

router.get("/activity", authMiddleware, requireRole("admin", "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const limit = Number(req.query.limit) || 20;
  const txs = await db
    .select({ tx: transactionsTable, user: usersTable })
    .from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(limit);

  res.json(txs.map(({ tx, user }) => ({
    id: tx.id,
    type: tx.type,
    description: tx.description || `${tx.type} transaction`,
    userId: tx.userId,
    userFullName: user?.fullName || null,
    amount: parseFloat(tx.amount as string),
    createdAt: tx.createdAt,
  })));
});

router.get("/pending-withdrawals", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const txs = await db
    .select({ tx: transactionsTable, user: usersTable })
    .from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")))
    .orderBy(desc(transactionsTable.createdAt));

  res.json(txs.map(({ tx, user }) => ({
    id: tx.id, transactionId: tx.transactionId, userId: tx.userId,
    userFullName: user?.fullName || null, type: tx.type,
    amount: parseFloat(tx.amount as string), status: tx.status,
    paymentMethod: tx.paymentMethod, reference: tx.reference,
    description: tx.description, createdAt: tx.createdAt,
  })));
});

// Approved withdrawals waiting for finance to pay
router.get("/approved-withdrawals", authMiddleware, requireRole("admin", "finance"), async (req: AuthRequest, res): Promise<void> => {
  const txs = await db
    .select({ tx: transactionsTable, user: usersTable })
    .from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "approved")))
    .orderBy(desc(transactionsTable.createdAt));

  res.json(txs.map(({ tx, user }) => ({
    id: tx.id, transactionId: tx.transactionId, userId: tx.userId,
    userFullName: user?.fullName || null, userEmail: user?.email || null,
    type: tx.type, amount: parseFloat(tx.amount as string), status: tx.status,
    paymentMethod: tx.paymentMethod, reference: tx.reference,
    description: tx.description, createdAt: tx.createdAt,
  })));
});

// Finance dashboard stats
router.get("/finance-stats", authMiddleware, requireRole("admin", "finance"), async (req: AuthRequest, res): Promise<void> => {
  const [{ pendingCount }] = await db.select({ pendingCount: sql<number>`count(*)` })
    .from(transactionsTable).where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "approved")));
  const [{ pendingValue }] = await db.select({ pendingValue: sql<number>`coalesce(sum(amount::numeric),0)` })
    .from(transactionsTable).where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "approved")));
  const [{ paidToday }] = await db.select({ paidToday: sql<number>`coalesce(sum(amount::numeric),0)` })
    .from(transactionsTable).where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "completed"), gte(transactionsTable.createdAt, new Date(new Date().setHours(0,0,0,0)))));
  const [{ paidTotal }] = await db.select({ paidTotal: sql<number>`coalesce(sum(amount::numeric),0)` })
    .from(transactionsTable).where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "completed")));
  const [{ paidCount }] = await db.select({ paidCount: sql<number>`count(*)` })
    .from(transactionsTable).where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "completed")));

  // Recent paid (last 10)
  const recent = await db.select({ tx: transactionsTable, user: usersTable })
    .from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "completed")))
    .orderBy(desc(transactionsTable.createdAt)).limit(10);

  res.json({
    pendingCount: Number(pendingCount),
    pendingValue: parseFloat(pendingValue as any) || 0,
    paidToday: parseFloat(paidToday as any) || 0,
    paidTotal: parseFloat(paidTotal as any) || 0,
    paidCount: Number(paidCount),
    recentPaid: recent.map(({ tx, user }) => ({
      id: tx.id, transactionId: tx.transactionId,
      userFullName: user?.fullName || null, amount: parseFloat(tx.amount as string),
      paymentMethod: tx.paymentMethod, reference: tx.reference, createdAt: tx.createdAt,
    })),
  });
});

// ── Vouchers ────────────────────────────────────────────────────────────────

const VOUCHER_VALUES = [1, 5, 10, 20, 50];

function generateCode(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

router.post("/vouchers", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const { amount, quantity = 1 } = req.body;
  if (!VOUCHER_VALUES.includes(Number(amount))) {
    res.status(400).json({ error: `Amount must be one of: ${VOUCHER_VALUES.join(", ")}` });
    return;
  }
  const count = Math.min(Math.max(1, Number(quantity)), 50);
  const vouchers = [];
  for (let i = 0; i < count; i++) {
    let code: string;
    let attempts = 0;
    do {
      code = generateCode();
      attempts++;
      if (attempts > 20) { res.status(500).json({ error: "Could not generate unique code" }); return; }
      const existing = await db.select().from(vouchersTable).where(eq(vouchersTable.code, code)).limit(1);
      if (!existing.length) break;
    } while (true);
    const [v] = await db.insert(vouchersTable).values({ code: code!, amount: String(amount), createdBy: req.userId! }).returning();
    vouchers.push(v);
  }
  res.status(201).json(vouchers.map(v => ({ id: v.id, code: v.code, amount: parseFloat(v.amount as string), isRedeemed: v.isRedeemed, createdAt: v.createdAt })));
});

router.get("/vouchers", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const vouchers = await db
    .select({ v: vouchersTable, redeemedByUser: usersTable })
    .from(vouchersTable)
    .leftJoin(usersTable, eq(vouchersTable.redeemedBy, usersTable.id))
    .orderBy(desc(vouchersTable.createdAt))
    .limit(200);
  res.json(vouchers.map(({ v, redeemedByUser }) => ({
    id: v.id,
    code: v.code,
    amount: parseFloat(v.amount as string),
    isRedeemed: v.isRedeemed,
    redeemedBy: v.redeemedBy,
    redeemedByName: redeemedByUser?.fullName || null,
    redeemedAt: v.redeemedAt,
    createdAt: v.createdAt,
  })));
});


// ── Admin wallet adjustments ─────────────────────────────────────────────────

router.post("/wallets/:userId/adjust", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const userId = Number(req.params.userId);
  const { type, amount, note } = req.body;
  if (!["credit", "debit"].includes(type)) { res.status(400).json({ error: "type must be credit or debit" }); return; }
  if (!amount || Number(amount) <= 0) { res.status(400).json({ error: "Invalid amount" }); return; }
  const amt = parseFloat(amount);

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
  if (!wallet) { res.status(404).json({ error: "Wallet not found" }); return; }

  if (type === "debit" && parseFloat(wallet.balance as string) < amt) {
    res.status(400).json({ error: "Insufficient balance" }); return;
  }

  const txType = type === "credit" ? "admin_credit" : "admin_debit";
  const sign = type === "credit" ? 1 : -1;

  await db.update(walletsTable).set({
    balance: sql`balance + ${sign * amt}`,
    availableBalance: sql`available_balance + ${sign * amt}`,
    withdrawableBalance: sql`withdrawable_balance + ${sign * amt}`,
  }).where(eq(walletsTable.userId, userId));

  const [tx] = await db.insert(transactionsTable).values({
    transactionId: `ADJ-${uuidv4().split("-")[0].toUpperCase()}`,
    userId,
    type: txType,
    amount: String(amt),
    status: "completed",
    paymentMethod: "internal",
    description: note || `Admin ${type} of $${amt}`,
  }).returning();

  await notify(userId, type === "credit" ? "deposit_received" : "withdrawal_approved",
    type === "credit" ? "Account Credited" : "Account Debited",
    `${type === "credit" ? "+" : "-"}$${amt} — ${note || `Admin ${type}`}`);

  res.json({ success: true, transaction: tx });
});

// ── Imported-user activation emails ──────────────────────────────────────────

router.get("/pending-activation", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usersTable)
    .where(eq(usersTable.mustSetPassword, true));
  res.json({ count: Number(count) });
});

router.post("/notify-pending", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, siteUrl } = req.body as Record<string, string>;

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
    res.status(400).json({ error: "SMTP configuration is required (host, user, password, from)" });
    return;
  }

  const site = (siteUrl || "https://atasportslive.com").replace(/\/$/, "");

  const pending = await db
    .select({ id: usersTable.id, email: usersTable.email, fullName: usersTable.fullName })
    .from(usersTable)
    .where(eq(usersTable.mustSetPassword, true));

  if (pending.length === 0) {
    res.json({ sent: 0, failed: 0, message: "No pending users found" });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort || "587", 10),
    secure: parseInt(smtpPort || "587", 10) === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const user of pending) {
    const setPasswordUrl = `${site}/set-password?email=${encodeURIComponent(user.email)}`;
    const firstName = (user.fullName || "").split(" ")[0] || "there";

    try {
      await transporter.sendMail({
        from: smtpFrom,
        to: user.email,
        subject: "Welcome to ATA Sports Live — Activate your account",
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
            <div style="background:#0f172a;padding:24px 32px;border-radius:8px 8px 0 0">
              <h1 style="color:#14b8a6;margin:0;font-size:20px">ATA Sports Live</h1>
            </div>
            <div style="background:#f8fafc;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
              <p style="margin:0 0 16px">Hi ${firstName},</p>
              <p style="margin:0 0 16px">
                Your ATA Sports Live account is ready. We've migrated your details from our
                previous platform — you just need to set a new password to get started.
              </p>
              <div style="text-align:center;margin:32px 0">
                <a href="${setPasswordUrl}"
                   style="background:#14b8a6;color:#fff;padding:14px 32px;border-radius:6px;
                          text-decoration:none;font-weight:bold;font-size:15px;display:inline-block">
                  Set My Password &amp; Sign In
                </a>
              </div>
              <p style="color:#64748b;font-size:13px;margin:0 0 8px">
                Or copy this link into your browser:
              </p>
              <p style="color:#0891b2;font-size:12px;word-break:break-all;margin:0 0 24px">${setPasswordUrl}</p>
              <p style="color:#64748b;font-size:13px;margin:0">
                Once set, you can watch live Pool &amp; Boxing streams and place bets on the platform.
              </p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
              <p style="color:#94a3b8;font-size:12px;margin:0;text-align:center">
                ATA Sports Live · Kampala, Uganda<br/>
                If you didn't expect this email, you can safely ignore it.
              </p>
            </div>
          </div>
        `,
        text: `Hi ${firstName},\n\nYour ATA Sports Live account is ready. Set your password here:\n${setPasswordUrl}\n\nATA Sports Live · Kampala, Uganda`,
      });
      sent++;
    } catch (e: any) {
      failed++;
      errors.push(`${user.email}: ${e.message}`);
    }
  }

  req.log.info({ sent, failed }, "Activation emails dispatched");
  res.json({ sent, failed, errors: errors.slice(0, 10) });
});

export default router;
