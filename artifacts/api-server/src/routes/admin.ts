import { Router } from "express";
import { randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { spawn } from "child_process";
import { v4 as uuidv4 } from "uuid";
import nodemailer from "nodemailer";
import { db, usersTable, walletsTable, transactionsTable, streamsTable, betsTable, notificationsTable, vouchersTable, promotionsTable, bonusTransactionsTable, promotionTermsAcceptanceTable } from "@workspace/db";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { notify } from "../lib/notify";

const router = Router();

router.get("/stats", authMiddleware, requireRole("admin", "manager", "content_editor"), async (req: AuthRequest, res): Promise<void> => {
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

router.get("/activity", authMiddleware, requireRole("admin", "manager", "content_editor"), async (req: AuthRequest, res): Promise<void> => {
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

router.get("/pending-withdrawals", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
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
router.get("/approved-withdrawals", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
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
router.get("/finance-stats", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
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

// Unambiguous alphanumeric alphabet — excludes 0/O, 1/I/L to avoid misreads
const VOUCHER_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // 31 chars

function generateCode(): string {
  let code = "";
  while (code.length < 12) {
    const byte = randomBytes(1)[0]!;
    // Rejection sampling: 31 * 8 = 248; drop bytes 248-255 to avoid modulo bias
    if (byte < 248) code += VOUCHER_CHARS[byte % VOUCHER_CHARS.length];
  }
  return code;
}

router.post("/vouchers", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
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

router.get("/vouchers", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
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

router.post("/wallets/:userId/adjust", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
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

router.get("/pending-activation", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usersTable)
    .where(eq(usersTable.mustSetPassword, true));
  res.json({ count: Number(count) });
});

router.post("/notify-pending", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
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

// ── Promotions Admin CRUD ─────────────────────────────────────────────────────

router.get("/promotions/stats", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const [total] = await db.select({ count: sql<number>`count(*)` }).from(promotionsTable);
  const [active] = await db.select({ count: sql<number>`count(*)` }).from(promotionsTable).where(eq(promotionsTable.status, "active"));
  const [issued] = await db.select({ sum: sql<number>`COALESCE(SUM(amount),0)` }).from(bonusTransactionsTable).where(eq(bonusTransactionsTable.type, "earned"));
  const [used] = await db.select({ sum: sql<number>`COALESCE(SUM(amount),0)` }).from(bonusTransactionsTable).where(eq(bonusTransactionsTable.type, "used"));
  const [revoked] = await db.select({ sum: sql<number>`COALESCE(SUM(amount),0)` }).from(bonusTransactionsTable).where(eq(bonusTransactionsTable.type, "revoked"));

  res.json({
    total: Number(total.count),
    active: Number(active.count),
    totalBonusIssued: parseFloat(String(issued.sum)) || 0,
    totalBonusUsed: parseFloat(String(used.sum)) || 0,
    totalBonusRevoked: parseFloat(String(revoked.sum)) || 0,
  });
});

router.get("/promotions", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const promos = await db.select().from(promotionsTable).orderBy(desc(promotionsTable.createdAt));
  res.json(promos.map(p => ({
    id: p.id, name: p.name, code: p.code, type: p.type, bonusType: p.bonusType,
    percentage: p.percentage ? parseFloat(p.percentage as string) : null,
    fixedAmount: p.fixedAmount ? parseFloat(p.fixedAmount as string) : null,
    minDeposit: parseFloat(p.minDeposit as string),
    maxBonus: p.maxBonus ? parseFloat(p.maxBonus as string) : null,
    maxUses: p.maxUses, usedCount: p.usedCount, startDate: p.startDate, endDate: p.endDate,
    status: p.status, description: p.description, bannerImageUrl: p.bannerImageUrl,
    termsConditions: p.termsConditions, bonusExpiryDays: p.bonusExpiryDays, createdAt: p.createdAt,
  })));
});

router.post("/promotions", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const { name, code, type, bonusType, percentage, fixedAmount, minDeposit, maxBonus, maxUses, startDate, endDate, status, description, termsConditions, bonusExpiryDays } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  if (bonusType === "percentage" && !percentage) { res.status(400).json({ error: "percentage required for percentage bonus" }); return; }
  if (bonusType === "fixed" && !fixedAmount) { res.status(400).json({ error: "fixedAmount required for fixed bonus" }); return; }

  const [promo] = await db.insert(promotionsTable).values({
    name, code: code?.trim().toUpperCase() || null, type: type || "automatic",
    bonusType: bonusType || "percentage",
    percentage: percentage?.toString() || null, fixedAmount: fixedAmount?.toString() || null,
    minDeposit: (minDeposit || 0).toString(), maxBonus: maxBonus?.toString() || null,
    maxUses: maxUses || null, startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null, status: status || "draft",
    description: description || null, termsConditions: termsConditions || null,
    bonusExpiryDays: bonusExpiryDays || null, createdBy: req.userId!,
  }).returning();
  res.status(201).json(promo);
});

router.patch("/promotions/:id", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const { name, code, type, bonusType, percentage, fixedAmount, minDeposit, maxBonus, maxUses, startDate, endDate, status, description, termsConditions, bonusExpiryDays } = req.body;
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (code !== undefined) updates.code = code?.trim().toUpperCase() || null;
  if (type !== undefined) updates.type = type;
  if (bonusType !== undefined) updates.bonusType = bonusType;
  if (percentage !== undefined) updates.percentage = percentage?.toString() || null;
  if (fixedAmount !== undefined) updates.fixedAmount = fixedAmount?.toString() || null;
  if (minDeposit !== undefined) updates.minDeposit = minDeposit.toString();
  if (maxBonus !== undefined) updates.maxBonus = maxBonus?.toString() || null;
  if (maxUses !== undefined) updates.maxUses = maxUses || null;
  if (startDate !== undefined) updates.startDate = startDate ? new Date(startDate) : null;
  if (endDate !== undefined) updates.endDate = endDate ? new Date(endDate) : null;
  if (status !== undefined) updates.status = status;
  if (description !== undefined) updates.description = description || null;
  if (termsConditions !== undefined) updates.termsConditions = termsConditions || null;
  if (bonusExpiryDays !== undefined) updates.bonusExpiryDays = bonusExpiryDays || null;
  updates.updatedAt = new Date();

  const [updated] = await db.update(promotionsTable).set(updates).where(eq(promotionsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/promotions/:id", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  await db.delete(promotionsTable).where(eq(promotionsTable.id, id));
  res.json({ ok: true });
});

router.post("/promotions/:id/revoke/:userId", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const promotionId = Number(req.params.id);
  const targetUserId = Number(req.params.userId);
  const { reason } = req.body;

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, targetUserId)).limit(1);
  if (!wallet) { res.status(404).json({ error: "User wallet not found" }); return; }

  const bonusBal = parseFloat((wallet.bonusBalance as string) || "0");
  if (bonusBal <= 0) { res.status(400).json({ error: "No bonus balance to revoke" }); return; }

  await db.update(walletsTable).set({ bonusBalance: sql`0` }).where(eq(walletsTable.userId, targetUserId));

  await db.insert(bonusTransactionsTable).values({
    userId: targetUserId,
    promotionId,
    type: "revoked",
    amount: bonusBal.toFixed(2),
    balanceBefore: bonusBal.toFixed(2),
    balanceAfter: "0",
    revokedBy: req.userId!,
    revokedReason: reason || "Admin revocation",
    description: `Bonus revoked by admin. Reason: ${reason || "Admin revocation"}`,
  });

  await notify(targetUserId, "deposit_received", "Bonus Revoked",
    `Your bonus balance has been revoked. ${reason ? `Reason: ${reason}` : ""}`);

  res.json({ ok: true, revokedAmount: bonusBal });
});

// Admin reset a user's password
router.post("/users/:id/reset-password", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const userId = Number(req.params.id);
  const { newPassword } = req.body as { newPassword?: string };
  if (!newPassword || newPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const hash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash: hash, mustSetPassword: false }).where(eq(usersTable.id, userId));
  res.json({ ok: true });
});

// ── Per-user wallet & transaction history (admin/manager) ────────────────────

router.get("/users/:userId/wallet", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) { res.status(400).json({ error: "Invalid userId" }); return; }
  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
  if (!wallet) { res.status(404).json({ error: "Wallet not found" }); return; }
  res.json({
    balance: parseFloat(wallet.balance as string) || 0,
    availableBalance: parseFloat(wallet.availableBalance as string) || 0,
    withdrawableBalance: parseFloat(wallet.withdrawableBalance as string) || 0,
    bonusBalance: parseFloat((wallet.bonusBalance as string) || "0") || 0,
  });
});

router.get("/users/:userId/transactions", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) { res.status(400).json({ error: "Invalid userId" }); return; }
  const rawPage = Number(req.query.page);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  const [txs, [{ total }]] = await Promise.all([
    db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.userId, userId))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)` })
      .from(transactionsTable)
      .where(eq(transactionsTable.userId, userId)),
  ]);

  res.json({
    transactions: txs.map(tx => ({
      id: tx.id,
      transactionId: tx.transactionId,
      type: tx.type,
      amount: parseFloat(tx.amount as string),
      status: tx.status,
      description: tx.description,
      paymentMethod: tx.paymentMethod,
      reference: tx.reference,
      createdAt: tx.createdAt,
    })),
    total: Number(total),
    page,
  });
});

router.get("/db-export", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    res.status(500).json({ error: "DATABASE_URL is not set" });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(dbUrl);
  } catch {
    res.status(500).json({ error: "DATABASE_URL is not a valid URL" });
    return;
  }

  const host     = parsed.hostname;
  const port     = parsed.port || "5432";
  const database = parsed.pathname.replace(/^\//, "");
  const username = parsed.username;
  const password = parsed.password;

  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="bck.sql"`);

  const env = { ...process.env, PGPASSWORD: password };
  const args = ["-h", host, "-p", port, "-U", username, "-d", database, "--no-owner", "--no-acl"];
  const dump = spawn("pg_dump", args, { env });

  dump.stdout.pipe(res);

  dump.stderr.on("data", (chunk: Buffer) => {
    req.log.warn({ msg: "pg_dump stderr", detail: chunk.toString() });
  });

  dump.on("error", (err) => {
    req.log.error({ err }, "pg_dump failed to start");
    if (!res.headersSent) res.status(500).json({ error: "pg_dump not available on this server" });
  });

  dump.on("close", (code) => {
    if (code !== 0) req.log.error({ code }, "pg_dump exited with non-zero code");
  });
});

export default router;
