import { Router } from "express";
import { randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { spawn } from "child_process";
import { v4 as uuidv4 } from "uuid";
import nodemailer from "nodemailer";
import multer from "multer";
import fs from "fs";
import os from "os";
import path from "path";
import { db, usersTable, walletsTable, transactionsTable, streamsTable, betsTable, notificationsTable, vouchersTable, promotionsTable, bonusTransactionsTable, promotionTermsAcceptanceTable, streamCommentsTable, commentBansTable } from "@workspace/db";
import { eq, sql, desc, and, gte, isNotNull, ilike, or, like, gt } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { notify, wsClients } from "../lib/notify";

const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

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
  const [{ totalWithdrawalsToday }] = await db.select({ totalWithdrawalsToday: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "completed"), like(transactionsTable.transactionId, "WIT-%"), gte(transactionsTable.createdAt, today)));

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

// Shared filter for the activity list/count endpoints — match on user email,
// full name or username (case-insensitive partial match).
const buildActivityUserFilter = (search: string) => search
  ? or(
      ilike(usersTable.email, `%${search}%`),
      ilike(usersTable.fullName, `%${search}%`),
      ilike(usersTable.username, `%${search}%`),
    )
  : undefined;

const getActivitySearch = (req: { query: unknown }) =>
  typeof req.query === "object" && req.query !== null && "search" in req.query && typeof req.query.search === "string"
    ? req.query.search.trim()
    : "";

const getActivityParam = (req: { query: unknown }, key: string): string =>
  typeof req.query === "object" && req.query !== null && key in req.query && typeof (req.query as any)[key] === "string"
    ? (req.query as any)[key].trim()
    : "";

/** Shared filter used by both the activity list and its count. */
const buildActivityFilter = (req: AuthRequest) => {
  const conditions: any[] = [];
  const userFilter = buildActivityUserFilter(getActivitySearch(req));
  if (userFilter) conditions.push(userFilter);
  const status = getActivityParam(req, "status");
  const type = getActivityParam(req, "type");
  if (status) conditions.push(eq(transactionsTable.status, status as any));
  if (type) conditions.push(eq(transactionsTable.type, type as any));
  return conditions.length ? and(...conditions) : undefined;
};

router.get("/activity", authMiddleware, requireRole("admin", "manager", "content_editor"), async (req: AuthRequest, res): Promise<void> => {
  const limit = Number(req.query.limit) || 20;
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const txs = await db
    .select({ tx: transactionsTable, user: usersTable })
    .from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .where(buildActivityFilter(req))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(txs.map(({ tx, user }: any) => ({
    id: tx.id,
    type: tx.type,
    status: tx.status,
    description: tx.description || `${tx.type} transaction`,
    userId: tx.userId,
    userFullName: user?.fullName || null,
    amount: parseFloat(tx.amount as string),
    paymentMethod: tx.paymentMethod,
    reference: tx.reference,
    createdAt: tx.createdAt,
  })));
});

router.get("/activity/count", authMiddleware, requireRole("admin", "manager", "content_editor"), async (req: AuthRequest, res): Promise<void> => {
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .where(buildActivityFilter(req));
  res.json({ total: Number(total) });
});

router.get("/pending-withdrawals", authMiddleware, requireRole("admin", "manager", "finance"), async (req: AuthRequest, res): Promise<void> => {
  const txs = await db
    .select({ tx: transactionsTable, user: usersTable })
    .from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")))
    .orderBy(desc(transactionsTable.createdAt));

  res.json(txs.map(({ tx, user }: any) => ({
    id: tx.id, transactionId: tx.transactionId, userId: tx.userId,
    userFullName: user?.fullName || null, type: tx.type,
    amount: parseFloat(tx.amount as string), status: tx.status,
    paymentMethod: tx.paymentMethod, reference: tx.reference,
    description: tx.description, createdAt: tx.createdAt,
  })));
});

// Approved withdrawals waiting for finance to pay
router.get("/approved-withdrawals", authMiddleware, requireRole("admin", "manager", "finance"), async (req: AuthRequest, res): Promise<void> => {
  const txs = await db
    .select({ tx: transactionsTable, user: usersTable })
    .from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "approved"), like(transactionsTable.transactionId, "WIT-%")))
    .orderBy(desc(transactionsTable.createdAt));

  res.json(txs.map(({ tx, user }: any) => ({
    id: tx.id, transactionId: tx.transactionId, userId: tx.userId,
    userFullName: user?.fullName || null, userEmail: user?.email || null,
    type: tx.type, amount: parseFloat(tx.amount as string), status: tx.status,
    paymentMethod: tx.paymentMethod, reference: tx.reference,
    description: tx.description, createdAt: tx.createdAt,
  })));
});

// Global withdrawal history (all users) for admin + finance
router.get("/withdrawal-history", authMiddleware, requireRole("admin", "manager", "finance"), async (req: AuthRequest, res): Promise<void> => {
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const requestedStatus = typeof req.query.status === "string" ? req.query.status : "";
  const statusCondition = ["pending", "approved", "completed", "rejected"].includes(requestedStatus)
    ? eq(transactionsTable.status, requestedStatus as any)
    : or(eq(transactionsTable.status, "completed"), eq(transactionsTable.status, "rejected"));
  const txs = await db
    .select({ tx: transactionsTable, user: usersTable })
    .from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .where(and(
      eq(transactionsTable.type, "withdrawal"),
      statusCondition,
      like(transactionsTable.transactionId, "WIT-%"),
    ))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(limit);

  res.json(txs.map(({ tx, user }: any) => ({
    id: tx.id, transactionId: tx.transactionId, userId: tx.userId,
    userFullName: user?.fullName || null, userEmail: user?.email || null,
    type: tx.type, amount: parseFloat(tx.amount as string), status: tx.status,
    paymentMethod: tx.paymentMethod, reference: tx.reference,
    description: tx.description, createdAt: tx.createdAt,
  })));
});

// Finance dashboard stats
router.get("/finance-stats", authMiddleware, requireRole("admin", "manager", "finance"), async (req: AuthRequest, res): Promise<void> => {
  const [{ pendingCount }] = await db.select({ pendingCount: sql<number>`count(*)` })
    .from(transactionsTable).where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "approved"), like(transactionsTable.transactionId, "WIT-%")));
  const [{ pendingValue }] = await db.select({ pendingValue: sql<number>`coalesce(sum(amount::numeric),0)` })
    .from(transactionsTable).where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "approved"), like(transactionsTable.transactionId, "WIT-%")));
  const [{ paidToday }] = await db.select({ paidToday: sql<number>`coalesce(sum(amount::numeric),0)` })
    .from(transactionsTable).where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "completed"), like(transactionsTable.transactionId, "WIT-%"), gte(transactionsTable.createdAt, new Date(new Date().setHours(0,0,0,0)))));
  const [{ paidTotal }] = await db.select({ paidTotal: sql<number>`coalesce(sum(amount::numeric),0)` })
    .from(transactionsTable).where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "completed"), like(transactionsTable.transactionId, "WIT-%")));
  const [{ paidCount }] = await db.select({ paidCount: sql<number>`count(*)` })
    .from(transactionsTable).where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "completed"), like(transactionsTable.transactionId, "WIT-%")));

  // Recent paid (last 10)
  const recent = await db.select({ tx: transactionsTable, user: usersTable })
    .from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "completed"), like(transactionsTable.transactionId, "WIT-%")))
    .orderBy(desc(transactionsTable.createdAt)).limit(10);

  res.json({
    pendingCount: Number(pendingCount),
    pendingValue: parseFloat(pendingValue as any) || 0,
    paidToday: parseFloat(paidToday as any) || 0,
    paidTotal: parseFloat(paidTotal as any) || 0,
    paidCount: Number(paidCount),
    recentPaid: recent.map(({ tx, user }: any) => ({
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
  res.json(vouchers.map(({ v, redeemedByUser }: any) => ({
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

/** Adjust a user's BONUS wallet only (cash balances are never touched). */
router.post("/wallets/:userId/bonus-adjust", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const userId = Number(req.params.userId);
  const { type, amount, note } = req.body;
  if (!["credit", "debit"].includes(type)) { res.status(400).json({ error: "type must be credit or debit" }); return; }
  if (!amount || Number(amount) <= 0) { res.status(400).json({ error: "Invalid amount" }); return; }
  const amt = parseFloat(amount);

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
  if (!wallet) { res.status(404).json({ error: "Wallet not found" }); return; }

  const before = parseFloat(wallet.bonusBalance as string);
  if (type === "debit" && before < amt) {
    res.status(400).json({ error: `Insufficient bonus balance ($${before.toFixed(2)})` }); return;
  }
  const after = type === "credit" ? before + amt : before - amt;

  await db.update(walletsTable).set({
    bonusBalance: sql`bonus_balance + ${type === "credit" ? amt : -amt}`,
    updatedAt: new Date(),
  }).where(eq(walletsTable.userId, userId));

  const reference = `BADJ-${uuidv4().split("-")[0].toUpperCase()}`;
  const [entry] = await db.insert(bonusTransactionsTable).values({
    userId,
    type: type === "credit" ? "earned" : "revoked",
    amount: String(amt),
    balanceBefore: String(before),
    balanceAfter: String(after),
    reference,
    description: note || `Admin ${type} of $${amt.toFixed(2)} to Bonus Wallet`,
    ...(type === "debit" ? { revokedBy: req.userId!, revokedReason: note || "Admin adjustment" } : {}),
  }).returning();

  await notify(userId, "general", "Bonus Wallet Updated",
    `${type === "credit" ? "+" : "-"}$${amt.toFixed(2)} — ${note || `Admin ${type}`}`);
  res.json({ success: true, balanceAfter: after, entry });
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

// Bonus Promotions: fixed-value, streaming-only credits that always expire.
// They are credited to the Bonus Wallet (never cash), so the existing wallet
// rules already prevent betting and withdrawals with them.
const BONUS_PROMO_TERMS =
  "Bonus funds are non-withdrawable and non-transferable. They are credited to your Bonus Wallet, " +
  "expire on the validity date shown, and may only be used to purchase ATA Sports livestream access. " +
  "Bonus funds cannot be used for predictions, betting or cash withdrawals.";

function getBonusPromoFields(fixedAmount: unknown, bonusExpiryDays: unknown) {
  const amount = Number(fixedAmount);
  const expiry = Number(bonusExpiryDays);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("fixedAmount greater than 0 is required for bonus promotions");
  }
  if (!Number.isFinite(expiry) || expiry <= 0) {
    throw new Error("bonusExpiryDays greater than 0 is required for bonus promotions");
  }
  return { fixedAmount: amount.toFixed(2), bonusExpiryDays: expiry };
}

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
  res.json(promos.map((p: any) => ({
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
  const b = { ...req.body };
  if (!b.name) { res.status(400).json({ error: "name is required" }); return; }
  if (b.bonusType === "percentage" && !b.percentage && b.type !== "bonus") { res.status(400).json({ error: "percentage required for percentage bonus" }); return; }
  if (b.bonusType === "fixed" && !b.fixedAmount) { res.status(400).json({ error: "fixedAmount required for fixed bonus" }); return; }

  if (b.type === "bonus") {
    try {
      const fields = getBonusPromoFields(b.fixedAmount, b.bonusExpiryDays);
      b.bonusType = "fixed";
      b.fixedAmount = fields.fixedAmount;
      b.bonusExpiryDays = fields.bonusExpiryDays;
      b.minDeposit = 0;
      if (b.maxUses === undefined || b.maxUses === null) b.maxUses = 1;
      if (!b.termsConditions) b.termsConditions = BONUS_PROMO_TERMS;
    } catch (e: any) {
      res.status(400).json({ error: e.message });
      return;
    }
  }

  const [promo] = await db.insert(promotionsTable).values({
    name: b.name, code: b.code?.trim().toUpperCase() || null, type: b.type || "automatic",
    bonusType: b.bonusType || "percentage",
    percentage: b.percentage?.toString() || null, fixedAmount: b.fixedAmount?.toString() || null,
    minDeposit: (b.minDeposit || 0).toString(), maxBonus: b.maxBonus?.toString() || null,
    maxUses: b.maxUses || null, startDate: b.startDate ? new Date(b.startDate) : null,
    endDate: b.endDate ? new Date(b.endDate) : null, status: b.status || "draft",
    description: b.description || null, termsConditions: b.termsConditions || null,
    bonusExpiryDays: b.bonusExpiryDays || null, createdBy: req.userId!,
  }).returning();
  res.status(201).json(promo);
});

// Generate multiple single-use Bonus Promotion codes at once.
router.post("/promotions/bulk", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const { name, fixedAmount, quantity, bonusExpiryDays, startDate, endDate, prefix, description, termsConditions } = req.body;
  if (!name || !String(name).trim()) { res.status(400).json({ error: "name is required" }); return; }

  let fields: { fixedAmount: string; bonusExpiryDays: number };
  try {
    fields = getBonusPromoFields(fixedAmount, bonusExpiryDays);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
    return;
  }

  const count = Math.min(Math.max(1, Math.floor(Number(quantity) || 1)), 100);
  const codePrefix = String(prefix || "BONUS").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "BONUS";
  const created: Array<{ id: number; code: string | null; fixedAmount: number; bonusExpiryDays: number | null; endDate: Date | null; status: string }> = [];

  for (let i = 0; i < count; i++) {
    let code = "";
    for (let attempt = 0; attempt < 20; attempt++) {
      code = `${codePrefix}-${randomBytes(5).toString("hex").toUpperCase()}`;
      const [exists] = await db.select({ id: promotionsTable.id }).from(promotionsTable).where(eq(promotionsTable.code, code)).limit(1);
      if (!exists) break;
      if (attempt === 19) { res.status(500).json({ error: "Could not generate a unique code" }); return; }
    }
    const [promo] = await db.insert(promotionsTable).values({
      name: `${String(name).trim()} #${i + 1}`,
      code,
      type: "bonus",
      bonusType: "fixed",
      fixedAmount: fields.fixedAmount,
      minDeposit: "0",
      maxUses: 1,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      status: "active",
      description: description || null,
      termsConditions: termsConditions || BONUS_PROMO_TERMS,
      bonusExpiryDays: fields.bonusExpiryDays,
      createdBy: req.userId!,
    }).returning();
    created.push({
      id: promo.id, code: promo.code, fixedAmount: parseFloat(promo.fixedAmount as string),
      bonusExpiryDays: promo.bonusExpiryDays, endDate: promo.endDate, status: promo.status,
    });
  }

  res.status(201).json({ count: created.length, promotions: created });
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

  const [existing] = await db.select().from(promotionsTable).where(eq(promotionsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if ((type !== undefined ? type : existing.type) === "bonus") {
    try {
      const fields = getBonusPromoFields(
        fixedAmount !== undefined ? fixedAmount : existing.fixedAmount,
        bonusExpiryDays !== undefined ? bonusExpiryDays : existing.bonusExpiryDays,
      );
      updates.bonusType = "fixed";
      updates.fixedAmount = fields.fixedAmount;
      updates.bonusExpiryDays = fields.bonusExpiryDays;
      updates.minDeposit = "0";
      if (updates.maxUses === undefined && existing.maxUses === null) updates.maxUses = 1;
      if (!updates.termsConditions && !existing.termsConditions) updates.termsConditions = BONUS_PROMO_TERMS;
    } catch (e: any) {
      res.status(400).json({ error: e.message });
      return;
    }
  }

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
    transactions: txs.map((tx: any) => ({
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

router.post("/db-restore", authMiddleware, requireRole("admin"), memUpload.single("backup"), async (req: AuthRequest, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No SQL file uploaded" });
    return;
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) { res.status(500).json({ error: "DATABASE_URL is not set" }); return; }

  let parsed: URL;
  try { parsed = new URL(dbUrl); } catch {
    res.status(500).json({ error: "DATABASE_URL is not a valid URL" }); return;
  }

  const host     = parsed.hostname;
  const port     = parsed.port || "5432";
  const database = parsed.pathname.replace(/^\//, "");
  const username = parsed.username;
  const password = parsed.password;

  const tmpFile = path.join(os.tmpdir(), `db-restore-${Date.now()}.sql`);
  fs.writeFileSync(tmpFile, req.file.buffer);

  const pgEnv = { ...process.env, PGPASSWORD: password };
  const baseArgs = ["-h", host, "-p", port, "-U", username, "-d", database];

  try {
    // Drop and recreate public schema
    await new Promise<void>((resolve, reject) => {
      const drop = spawn("psql", [...baseArgs, "-c", "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"], { env: pgEnv });
      drop.stderr.on("data", (c: Buffer) => req.log.warn({ msg: "schema reset stderr", detail: c.toString() }));
      drop.on("close", (code) => code === 0 ? resolve() : reject(new Error(`Schema reset exited ${code}`)));
      drop.on("error", reject);
    });

    // Restore from uploaded file
    await new Promise<void>((resolve, reject) => {
      const restore = spawn("psql", [...baseArgs, "-f", tmpFile], { env: pgEnv });
      restore.stderr.on("data", (c: Buffer) => req.log.warn({ msg: "psql restore stderr", detail: c.toString() }));
      restore.on("close", (code) => code === 0 ? resolve() : reject(new Error(`Restore exited ${code}`)));
      restore.on("error", reject);
    });

    req.log.info({ file: req.file.originalname, size: req.file.size }, "Database restored");
    res.json({ ok: true, message: "Database restored successfully" });
  } catch (err: any) {
    req.log.error({ err }, "db-restore failed");
    res.status(500).json({ error: err.message || "Restore failed" });
  } finally {
    fs.unlink(tmpFile, () => {});
  }
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

// ── Active Sessions ────────────────────────────────────────────────────────

router.get("/sessions", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      fullName: usersTable.fullName,
      email: usersTable.email,
      role: usersTable.role,
      status: usersTable.status,
      updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .where(isNotNull(usersTable.sessionToken))
    .orderBy(desc(usersTable.updatedAt));

  const result = users.map((u: any) => ({
    ...u,
    onlineNow: wsClients.has(u.id) && wsClients.get(u.id)!.readyState === 1,
  }));

  res.json(result);
});

// ── Influencer Management ─────────────────────────────────────────────────────

/** Generate a unique influencer referral code with INF prefix */
async function createInfluencerCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 15; attempt++) {
    let suffix = "";
    for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
    const code = `INF${suffix}`;
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.referralCode, code))
      .limit(1);
    if (!existing) return code;
  }
  return `INF${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

async function createSuperInfluencerCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 15; attempt++) {
    let suffix = "";
    for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
    const code = `SINF${suffix}`;
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.referralCode, code))
      .limit(1);
    if (!existing) return code;
  }
  return `SINF${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

// Set or unset influencer status for a user
router.patch("/users/:id/set-influencer", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  const { isInfluencer } = req.body as { isInfluencer: boolean };
  if (typeof isInfluencer !== "boolean") {
    res.status(400).json({ error: "isInfluencer (boolean) required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  let newReferralCode = user.referralCode;

  if (isInfluencer && !user.isInfluencer) {
    // Promote: generate a new INF-prefixed referral code
    newReferralCode = await createInfluencerCode();
  } else if (!isInfluencer && user.isInfluencer) {
    // Demote: generate a regular referral code
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    newReferralCode = code;
  }

  await db.update(usersTable)
    .set({ isInfluencer, referralCode: newReferralCode })
    .where(eq(usersTable.id, userId));

  res.json({ ok: true, isInfluencer, referralCode: newReferralCode });
});

// Set or unset super influencer status for a user
router.patch("/users/:id/set-super-influencer", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  const { isSuperInfluencer } = req.body as { isSuperInfluencer: boolean };
  if (typeof isSuperInfluencer !== "boolean") {
    res.status(400).json({ error: "isSuperInfluencer (boolean) required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  let newReferralCode = user.referralCode;

  if (isSuperInfluencer && !user.isSuperInfluencer) {
    // Promote to Super Influencer: assign SINF- prefixed code
    newReferralCode = await createSuperInfluencerCode();
  } else if (!isSuperInfluencer && user.isSuperInfluencer) {
    // Demote: downgrade to a regular INF- code (keeps influencer status)
    newReferralCode = await createInfluencerCode();
  }

  await db.update(usersTable)
    .set({
      isSuperInfluencer,
      isInfluencer: isSuperInfluencer ? true : user.isInfluencer,
      referralCode: newReferralCode,
      ...(isSuperInfluencer ? {} : { superInfluencerCommissionRate: null }),
    })
    .where(eq(usersTable.id, userId));

  res.json({ ok: true, isSuperInfluencer, referralCode: newReferralCode });
});

// Set the personalised commission rate for a super influencer
router.patch("/users/:id/super-influencer-rate", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  const { rate } = req.body as { rate: number };
  if (typeof rate !== "number" || rate < 0 || rate > 100) {
    res.status(400).json({ error: "rate must be a number between 0 and 100" });
    return;
  }

  const [user] = await db
    .select({ id: usersTable.id, isSuperInfluencer: usersTable.isSuperInfluencer })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (!user.isSuperInfluencer) { res.status(400).json({ error: "User is not a Super Influencer" }); return; }

  await db.update(usersTable)
    .set({ superInfluencerCommissionRate: rate.toFixed(2) })
    .where(eq(usersTable.id, userId));

  res.json({ ok: true, rate });
});

// List all influencers with referral counts and total commissions paid out
router.get("/influencers", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const influencers = await db
    .select({
      id: usersTable.id,
      fullName: usersTable.fullName,
      username: usersTable.username,
      email: usersTable.email,
      referralCode: usersTable.referralCode,
      createdAt: usersTable.createdAt,
      status: usersTable.status,
      isSuperInfluencer: usersTable.isSuperInfluencer,
      superInfluencerCommissionRate: usersTable.superInfluencerCommissionRate,
    })
    .from(usersTable)
    .where(eq(usersTable.isInfluencer, true))
    .orderBy(desc(usersTable.createdAt));

  // Enrich with referral counts and total commissions
  const enriched = await Promise.all(
    influencers.map(async (inf: typeof influencers[number]) => {
      const [refCount] = await db
        .select({ referralCount: sql<number>`count(*)` })
        .from(usersTable)
        .where(eq(usersTable.referredBy, inf.id));

      const [commRow] = await db
        .select({ totalCommission: sql<number>`coalesce(sum(amount::numeric), 0)` })
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.userId, inf.id),
            eq(transactionsTable.type, "influencer_commission")
          )
        );

      return {
        ...inf,
        referralCount: Number(refCount?.referralCount ?? 0),
        totalCommissionEarned: parseFloat(String(commRow?.totalCommission ?? 0)) || 0,
        superInfluencerCommissionRate: inf.superInfluencerCommissionRate
          ? parseFloat(String(inf.superInfluencerCommissionRate))
          : null,
      };
    })
  );

  res.json(enriched);
});

// Get referrals for a specific influencer
router.get("/influencers/:id/referrals", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const influencerId = Number(req.params.id);
  if (!Number.isInteger(influencerId) || influencerId <= 0) {
    res.status(400).json({ error: "Invalid influencer id" });
    return;
  }

  const [influencer] = await db
    .select({ id: usersTable.id, isInfluencer: usersTable.isInfluencer, fullName: usersTable.fullName })
    .from(usersTable)
    .where(eq(usersTable.id, influencerId))
    .limit(1);

  if (!influencer) { res.status(404).json({ error: "User not found" }); return; }
  if (!influencer.isInfluencer) { res.status(400).json({ error: "User is not an influencer" }); return; }

  const referrals = await db
    .select({
      id: usersTable.id,
      fullName: usersTable.fullName,
      username: usersTable.username,
      email: usersTable.email,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.referredBy, influencerId))
    .orderBy(desc(usersTable.createdAt));

  // Per-referral subscription spend
  const enriched = await Promise.all(
    referrals.map(async (ref: typeof referrals[number]) => {
      const [spendRow] = await db
        .select({ totalSpend: sql<number>`coalesce(sum(amount::numeric), 0)` })
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.userId, ref.id),
            eq(transactionsTable.type, "stream_access")
          )
        );
      return { ...ref, totalSubscriptionSpend: parseFloat(String(spendRow?.totalSpend ?? 0)) || 0 };
    })
  );

  res.json({
    influencer: { id: influencer.id, fullName: influencer.fullName },
    referrals: enriched,
    total: enriched.length,
  });
});

router.delete("/sessions/:userId", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const userId = parseInt(req.params.userId as string);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }

  const ws = wsClients.get(userId);
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({
      type: "session_displaced",
      title: "Session ended by administrator",
      message: "An administrator has ended your session. Please log in again.",
    }));
  }

  await db.update(usersTable)
    .set({ sessionToken: null, refreshToken: null })
    .where(eq(usersTable.id, userId));

  req.log.info({ adminId: req.userId, targetUserId: userId }, "Admin force-logged-out user");
  res.json({ ok: true });
});

// ── Comment moderation (admin + manager) ────────────────────────────────────

router.get("/comments", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const hiddenOnly = req.query.hidden === "true";
  const conditions: any[] = [];
  if (hiddenOnly) conditions.push(eq(streamCommentsTable.isHidden, true));
  if (search) conditions.push(or(
    ilike(streamCommentsTable.content, `%${search}%`),
    ilike(streamCommentsTable.username, `%${search}%`),
    ilike(usersTable.email, `%${search}%`),
  ));
  const rows = await db
    .select({ comment: streamCommentsTable, user: usersTable, stream: streamsTable })
    .from(streamCommentsTable)
    .leftJoin(usersTable, eq(streamCommentsTable.userId, usersTable.id))
    .leftJoin(streamsTable, eq(streamCommentsTable.streamId, streamsTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(streamCommentsTable.createdAt))
    .limit(limit);

  res.json(rows.map(({ comment, user, stream }: any) => ({
    id: comment.id,
    streamId: comment.streamId,
    streamTitle: stream?.title ?? `Stream #${comment.streamId}`,
    userId: comment.userId,
    username: comment.username,
    userEmail: user?.email ?? null,
    content: comment.content,
    isHidden: comment.isHidden,
    hiddenAt: comment.hiddenAt,
    hideReason: comment.hideReason,
    createdAt: comment.createdAt,
  })));
});

router.patch("/comments/:id/hide", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const { hidden, reason } = req.body as { hidden?: boolean; reason?: string };
  if (!Number.isInteger(id) || id <= 0 || typeof hidden !== "boolean") {
    res.status(400).json({ error: "id and hidden (boolean) are required" }); return;
  }
  const [updated] = await db.update(streamCommentsTable).set({
    isHidden: hidden,
    hiddenBy: hidden ? req.userId! : null,
    hiddenAt: hidden ? new Date() : null,
    hideReason: hidden ? (reason?.trim() || null) : null,
  }).where(eq(streamCommentsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Comment not found" }); return; }
  res.json({ ok: true, isHidden: updated.isHidden });
});

router.get("/comment-bans", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const rows = await db
    .select({ ban: commentBansTable, user: usersTable })
    .from(commentBansTable)
    .leftJoin(usersTable, eq(commentBansTable.userId, usersTable.id))
    .where(gt(commentBansTable.bannedUntil, new Date()))
    .orderBy(desc(commentBansTable.bannedUntil));
  res.json(rows.map(({ ban, user }: any) => ({
    userId: ban.userId,
    username: user?.fullName ?? user?.email ?? `User #${ban.userId}`,
    userEmail: user?.email ?? null,
    bannedUntil: ban.bannedUntil,
    reason: ban.reason,
    createdAt: ban.createdAt,
  })));
});

router.post("/comment-bans", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const { userId, hours, reason } = req.body as { userId?: number; hours?: number; reason?: string };
  const duration = Number(hours);
  if (!userId || !Number.isFinite(duration) || duration <= 0 || duration > 24 * 365) {
    res.status(400).json({ error: "Valid userId and hours (1–8760) are required" }); return;
  }
  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, Number(userId))).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const bannedUntil = new Date(Date.now() + duration * 60 * 60 * 1000);
  await db.insert(commentBansTable).values({
    userId: Number(userId),
    bannedUntil,
    reason: reason?.trim() || null,
    createdBy: req.userId!,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: commentBansTable.userId,
    set: { bannedUntil, reason: reason?.trim() || null, createdBy: req.userId!, updatedAt: new Date() },
  });
  res.json({ ok: true, bannedUntil });
});

router.delete("/comment-bans/:userId", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  await db.delete(commentBansTable).where(eq(commentBansTable.userId, Number(req.params.userId)));
  res.json({ ok: true });
});

export default router;
