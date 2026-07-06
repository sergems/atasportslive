import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, walletsTable, transactionsTable, usersTable, vouchersTable, promotionsTable, bonusTransactionsTable, promotionTermsAcceptanceTable } from "@workspace/db";
import { eq, sql, desc, and, lte, gte, or, isNull } from "drizzle-orm";
import { creditBonus, findMatchingAutoPromo } from "./promotions";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { notify } from "../lib/notify";
import { sendMail, templates } from "../lib/mailer";
import { logger } from "../lib/logger";
import {
  getPesapalConfig,
  getAccessToken,
  ensureIPN,
  submitOrder,
  getTransactionStatus,
} from "../lib/pesapal";
import {
  getPawapayConfig,
  initiateDeposit as pawapayInitiateDeposit,
  initiatePayout as pawapayInitiatePayout,
  providerForMethod,
} from "../lib/pawapay";

const router = Router();

/** Read a single setting value from the DB. Returns null if not found. */
async function getSetting(key: string): Promise<string | null> {
  const rows = await db.execute(sql`SELECT value FROM settings WHERE key = ${key} LIMIT 1`);
  const row = (rows.rows as { value: string }[])[0];
  return row?.value ?? null;
}

/**
 * Returns true if the gateway is enabled (default: true if key not set).
 * Set `pesapal_enabled` or `pawapay_enabled` to 'false' to disable.
 */
async function isGatewayEnabled(gateway: "pesapal" | "pawapay"): Promise<boolean> {
  const val = await getSetting(`${gateway}_enabled`);
  return val !== "false";
}

const toWalletResponse = (w: typeof walletsTable.$inferSelect) => ({
  id: w.id,
  userId: w.userId,
  balance: parseFloat(w.balance as string),
  availableBalance: parseFloat(w.availableBalance as string),
  pendingBalance: parseFloat(w.pendingBalance as string),
  withdrawableBalance: parseFloat(w.withdrawableBalance as string),
  bonusBalance: parseFloat((w.bonusBalance as string) || "0"),
  currency: w.currency,
});

const toTxResponse = (t: typeof transactionsTable.$inferSelect, userFullName?: string) => ({
  id: t.id,
  transactionId: t.transactionId,
  userId: t.userId,
  userFullName: userFullName || null,
  type: t.type,
  amount: parseFloat(t.amount as string),
  status: t.status,
  paymentMethod: t.paymentMethod,
  reference: t.reference,
  description: t.description,
  createdAt: t.createdAt,
});

router.get("/", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.userId!)).limit(1);
  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }
  res.json(toWalletResponse(wallet));
});

router.post("/deposit", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { amount, paymentMethod, reference } = req.body;
  if (!amount || amount <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }
  const validMethods = ["mtn_momo", "airtel_money", "btc_binance"];
  if (!validMethods.includes(paymentMethod)) {
    res.status(400).json({ error: "Invalid payment method" });
    return;
  }
  const [tx] = await db
    .insert(transactionsTable)
    .values({
      transactionId: `DEP-${uuidv4().split("-")[0].toUpperCase()}`,
      userId: req.userId!,
      type: "deposit",
      amount: amount.toString(),
      status: "pending",
      paymentMethod,
      reference: reference || null,
      description: `Deposit via ${paymentMethod}`,
    })
    .returning();

  // For demo: auto-confirm deposit
  await db.update(transactionsTable).set({ status: "completed" }).where(eq(transactionsTable.id, tx.id));
  await db.update(walletsTable).set({
    balance: sql`balance + ${amount}`,
    availableBalance: sql`available_balance + ${amount}`,
    withdrawableBalance: sql`withdrawable_balance + ${amount}`,
  }).where(eq(walletsTable.userId, req.userId!));

  await notify(req.userId!, "deposit_received", "Deposit Confirmed", `$${amount} has been added to your wallet.`);

  // Check for matching automatic promotions — return as pendingBonus (user must accept terms)
  const matchingPromo = await findMatchingAutoPromo(amount);
  let pendingBonus = null;
  if (matchingPromo) {
    const alreadyAccepted = await db.select().from(promotionTermsAcceptanceTable).where(
      and(eq(promotionTermsAcceptanceTable.userId, req.userId!), eq(promotionTermsAcceptanceTable.promotionId, matchingPromo.id))
    ).limit(1);

    if (!alreadyAccepted.length) {
      const pct = matchingPromo.percentage ? parseFloat(matchingPromo.percentage as string) : null;
      const fixed = matchingPromo.fixedAmount ? parseFloat(matchingPromo.fixedAmount as string) : null;
      let est = pct ? (amount * pct) / 100 : (fixed || 0);
      if (matchingPromo.maxBonus) est = Math.min(est, parseFloat(matchingPromo.maxBonus as string));
      pendingBonus = {
        promotionId: matchingPromo.id,
        name: matchingPromo.name,
        estimatedBonus: Math.round(est * 100) / 100,
        termsConditions: matchingPromo.termsConditions,
        depositTransactionId: tx.transactionId,
      };
    }
  }

  const updatedTx = await db.select().from(transactionsTable).where(eq(transactionsTable.id, tx.id)).limit(1);
  res.status(201).json({ ...toTxResponse(updatedTx[0]), pendingBonus });
});

router.get("/payout-method", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const rows = await db.execute(
    sql`SELECT payout_method, payout_account, payout_method_set_at FROM users WHERE id = ${req.userId}`
  );
  const r = (rows.rows?.[0] as any) ?? null;
  res.json({
    payoutMethod: r?.payout_method ?? null,
    payoutAccount: r?.payout_account ?? null,
    payoutMethodSetAt: r?.payout_method_set_at ?? null,
  });
});

router.post("/payout-method", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { payoutMethod, payoutAccount } = req.body;
  const validMethods = ["mtn_momo", "airtel_money", "btc_binance"];
  if (!validMethods.includes(payoutMethod)) {
    res.status(400).json({ error: "Invalid payout method" });
    return;
  }
  if (!payoutAccount || typeof payoutAccount !== "string" || !payoutAccount.trim()) {
    res.status(400).json({ error: "Payout account details are required" });
    return;
  }

  // Check if already set
  const existing = await db.execute(
    sql`SELECT payout_method_set_at FROM users WHERE id = ${req.userId}`
  );
  const row = (existing.rows?.[0] as any) ?? null;
  if (row?.payout_method_set_at) {
    res.status(400).json({ error: "Payout method already set. Contact admin to change it." });
    return;
  }

  await db.execute(
    sql`UPDATE users SET payout_method = ${payoutMethod}, payout_account = ${payoutAccount.trim()}, payout_method_set_at = NOW() WHERE id = ${req.userId}`
  );
  res.json({ ok: true, payoutMethod, payoutAccount: payoutAccount.trim() });
});

router.post("/withdraw", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { amount } = req.body;
  if (!amount || Number(amount) <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  // Must have completed FICA verification first
  const userRows = await db.execute(
    sql`SELECT payout_method, payout_account, payout_method_set_at, fica_completed FROM users WHERE id = ${req.userId}`
  );
  const userRow = (userRows.rows?.[0] as any) ?? null;
  if (!userRow?.fica_completed) {
    res.status(403).json({ error: "Identity verification (FICA) must be completed before withdrawing." });
    return;
  }

  // Must have a verified payout method
  if (!userRow?.payout_method || !userRow?.payout_account) {
    res.status(400).json({ error: "You must set a payout method before withdrawing." });
    return;
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.userId!)).limit(1);
  if (!wallet || parseFloat(wallet.withdrawableBalance as string) < Number(amount)) {
    res.status(400).json({ error: "Insufficient withdrawable balance" });
    return;
  }

  // Determine if PawaPay instant payout can be used (mobile money methods only)
  const isMobileMoney = ["mtn_momo", "airtel_money"].includes(userRow.payout_method);
  const pawapayGatewayEnabled = isMobileMoney ? await isGatewayEnabled("pawapay") : false;
  const pawapayConfig = (isMobileMoney && pawapayGatewayEnabled) ? await getPawapayConfig() : null;
  const useInstantPayout = !!(pawapayConfig && isMobileMoney);

  // Lock funds
  await db.update(walletsTable).set({
    withdrawableBalance: sql`withdrawable_balance - ${Number(amount)}`,
    availableBalance: sql`available_balance - ${Number(amount)}`,
    pendingBalance: sql`pending_balance + ${Number(amount)}`,
  }).where(eq(walletsTable.userId, req.userId!));

  if (useInstantPayout && pawapayConfig) {
    // PawaPay instant payout — UUID is the payoutId used with PawaPay
    const payoutId = uuidv4();
    const [tx] = await db.insert(transactionsTable).values({
      transactionId: payoutId,
      userId: req.userId!,
      type: "withdrawal",
      amount: Number(amount).toFixed(2),
      status: "approved",
      paymentMethod: "pawapay",
      reference: userRow.payout_account,
      description: `Instant withdrawal via PawaPay to ${userRow.payout_method.replace(/_/g, " ")} ${userRow.payout_account}`,
    }).returning();

    try {
      await pawapayInitiatePayout(pawapayConfig, {
        payoutId,
        amount: Number(amount),
        phoneNumber: userRow.payout_account,
        provider: providerForMethod(userRow.payout_method),
      });
      res.status(201).json({ ...toTxResponse(tx), instant: true });
    } catch (err: any) {
      // Rollback funds if PawaPay call fails
      await db.update(transactionsTable).set({ status: "failed" }).where(eq(transactionsTable.id, tx.id));
      await db.update(walletsTable).set({
        withdrawableBalance: sql`withdrawable_balance + ${Number(amount)}`,
        availableBalance: sql`available_balance + ${Number(amount)}`,
        pendingBalance: sql`pending_balance - ${Number(amount)}`,
      }).where(eq(walletsTable.userId, req.userId!));
      req.log.error({ err }, "PawaPay payout initiation error");
      res.status(502).json({ error: err.message || "Payout gateway error. Please try again." });
    }
    return;
  }

  // Standard flow: pending for admin approval (Pesapal users, BTC, or when PawaPay not configured)
  const [tx] = await db
    .insert(transactionsTable)
    .values({
      transactionId: `WIT-${uuidv4().split("-")[0].toUpperCase()}`,
      userId: req.userId!,
      type: "withdrawal",
      amount: Number(amount).toFixed(2),
      status: "pending",
      paymentMethod: userRow.payout_method as any,
      reference: userRow.payout_account,
      description: `Withdrawal via ${userRow.payout_method} to ${userRow.payout_account}`,
    })
    .returning();
  res.status(201).json(toTxResponse(tx));
});

router.get("/transactions", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, req.userId!));

  const txs = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, req.userId!))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ transactions: txs.map((t: any) => toTxResponse(t)), total: Number(count), page, limit });
});

router.patch("/admin/approve-withdrawal/:id", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!tx || tx.type !== "withdrawal" || tx.status !== "pending") {
    res.status(400).json({ error: "Invalid withdrawal" });
    return;
  }
  // Move to "approved" — funds stay locked in pendingBalance until finance confirms payment
  await db.update(transactionsTable).set({ status: "approved" }).where(eq(transactionsTable.id, id));
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, tx.userId)).limit(1);
  await notify(tx.userId, "withdrawal_approved", "Withdrawal Approved", `Your withdrawal of $${tx.amount} has been approved and is being processed by our finance team.`);

  // Email user
  if (user?.email) {
    sendMail({
      to: user.email,
      subject: "Withdrawal Approved – ATA Sports Live",
      html: templates.withdrawalApprovedUser({
        name: user.fullName ?? user.email,
        amount: parseFloat(tx.amount as string),
        method: tx.paymentMethod?.replace(/_/g, " ") ?? "",
        account: tx.reference ?? "",
      }),
    }).catch(() => {});
  }

  // Email all manager and finance-role users
  const financeUsers = await db.select().from(usersTable).where(
    sql`role IN ('manager', 'finance')`
  );
  const approvedList = await db.select().from(transactionsTable).where(
    eq(transactionsTable.status, "approved")
  );
  const approvedCount = approvedList.filter((t: any) => t.type === "withdrawal").length;
  const approvedValue = approvedList.filter((t: any) => t.type === "withdrawal")
    .reduce((s: number, t: any) => s + parseFloat(t.amount as string), 0);

  for (const fu of financeUsers) {
    if (fu.email) {
      sendMail({
        to: fu.email,
        subject: `New Withdrawal to Pay – $${parseFloat(tx.amount as string).toFixed(2)} via ${tx.paymentMethod ?? ""}`,
        html: templates.withdrawalFinanceAlert({
          count: approvedCount,
          totalValue: approvedValue,
          userName: user?.fullName ?? `User #${tx.userId}`,
          amount: parseFloat(tx.amount as string),
          method: tx.paymentMethod?.replace(/_/g, " ") ?? "",
          account: tx.reference ?? "",
        }),
      }).catch(() => {});
    }
  }

  const [updated] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  res.json(toTxResponse(updated));
});

// Finance: mark approved withdrawal as paid (actual payment confirmed)
router.patch("/finance/mark-paid/:id", authMiddleware, requireRole("admin", "manager", "finance"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!tx || tx.type !== "withdrawal" || tx.status !== "approved") {
    res.status(400).json({ error: "Invalid or not yet approved withdrawal" });
    return;
  }
  await db.update(transactionsTable).set({ status: "completed" }).where(eq(transactionsTable.id, id));
  // Now actually deduct from balance
  await db.update(walletsTable).set({
    balance: sql`balance - ${parseFloat(tx.amount as string)}`,
    pendingBalance: sql`pending_balance - ${parseFloat(tx.amount as string)}`,
  }).where(eq(walletsTable.userId, tx.userId));
  const [paidUser] = await db.select().from(usersTable).where(eq(usersTable.id, tx.userId)).limit(1);
  await notify(tx.userId, "withdrawal_approved", "Payment Sent", `Your withdrawal of $${tx.amount} has been paid. Please check your ${tx.paymentMethod?.replace("_", " ")} account.`);

  // Email user
  if (paidUser?.email) {
    sendMail({
      to: paidUser.email,
      subject: "Payment Sent – ATA Sports Live",
      html: templates.withdrawalPaidUser({
        name: paidUser.fullName ?? paidUser.email,
        amount: parseFloat(tx.amount as string),
        method: tx.paymentMethod?.replace(/_/g, " ") ?? "",
        account: tx.reference ?? "",
      }),
    }).catch(() => {});
  }

  const [updated] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  res.json(toTxResponse(updated));
});

router.patch("/admin/reject-withdrawal/:id", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const { note } = req.body as { note?: string };
  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!tx || tx.type !== "withdrawal" || tx.status !== "pending") {
    res.status(400).json({ error: "Invalid withdrawal" });
    return;
  }
  await db.update(transactionsTable).set({ status: "rejected" }).where(eq(transactionsTable.id, id));
  // Return funds
  await db.update(walletsTable).set({
    withdrawableBalance: sql`withdrawable_balance + ${parseFloat(tx.amount as string)}`,
    availableBalance: sql`available_balance + ${parseFloat(tx.amount as string)}`,
    pendingBalance: sql`pending_balance - ${parseFloat(tx.amount as string)}`,
  }).where(eq(walletsTable.userId, tx.userId));

  const reason = note?.trim() ? ` Reason: ${note.trim()}` : "";
  await notify(tx.userId, "withdrawal_rejected", "Withdrawal Rejected", `Your withdrawal of $${tx.amount} has been rejected.${reason}`);
  const [rejUser] = await db.select().from(usersTable).where(eq(usersTable.id, tx.userId)).limit(1);
  if (rejUser?.email) {
    sendMail({
      to: rejUser.email,
      subject: "Withdrawal Request Rejected – ATA Sports Live",
      html: templates.withdrawalRejectedUser({
        name: rejUser.fullName ?? rejUser.email,
        amount: parseFloat(tx.amount as string),
        note: note?.trim(),
      }),
    }).catch(() => {});
  }
  const [updated] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  res.json(toTxResponse(updated));
});

router.patch("/admin/deposit/:id/confirm", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }

  // Atomic claim: only the first caller (admin confirm OR IPN/callback) that flips
  // status from 'pending' → 'completed' will get a row back. The other gets nothing
  // and exits cleanly, preventing any double-credit.
  const [claimed] = await db
    .update(transactionsTable)
    .set({ status: "completed" })
    .where(and(eq(transactionsTable.id, id), eq(transactionsTable.status, "pending"), eq(transactionsTable.type, "deposit")))
    .returning();

  if (!claimed) {
    // Either not found, wrong type, or already processed by another path
    const [existing] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Transaction not found" }); return; }
    if (existing.status === "completed") { res.json({ alreadyCompleted: true, transaction: toTxResponse(existing) }); return; }
    res.status(400).json({ error: "Must be a pending deposit" }); return;
  }

  const amt = parseFloat(claimed.amount as string);
  await db.update(walletsTable).set({
    balance: sql`balance + ${amt}`,
    availableBalance: sql`available_balance + ${amt}`,
    withdrawableBalance: sql`withdrawable_balance + ${amt}`,
  }).where(eq(walletsTable.userId, claimed.userId));

  await notify(claimed.userId, "deposit_received", "Deposit Confirmed", `${amt.toFixed(2)} has been added to your wallet.`);

  const [updated] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  res.json(toTxResponse(updated));
});

// Admin: fail a pending deposit (no wallet changes — balance was never credited)
router.patch("/admin/deposit/:id/fail", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!tx || tx.type !== "deposit" || tx.status !== "pending") {
    res.status(400).json({ error: "Must be a pending deposit" }); return;
  }
  await db.update(transactionsTable).set({ status: "failed" }).where(eq(transactionsTable.id, id));
  await notify(tx.userId, "deposit_received", "Deposit Failed",
    `Your deposit of ${parseFloat(tx.amount as string).toFixed(2)} could not be verified and has been marked failed. Contact support if you believe this is an error.`);
  const [updated] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  res.json(toTxResponse(updated));
});

// Admin: re-query Pesapal for a stuck pending deposit and auto-confirm if paid
router.post("/admin/deposit/:id/recheck", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!tx || tx.type !== "deposit" || tx.status !== "pending") {
    res.status(400).json({ error: "Must be a pending deposit" }); return;
  }

  // orderTrackingId is stored in reference (after initiation) or inside metadata JSON
  let orderTrackingId: string | null = tx.reference ?? null;
  if (!orderTrackingId && tx.metadata) {
    try { orderTrackingId = (JSON.parse(tx.metadata as string) as any)?.orderTrackingId ?? null; } catch { /* ignore */ }
  }
  if (!orderTrackingId) {
    res.status(400).json({ error: "No gateway reference on this transaction — use manual Confirm instead" }); return;
  }

  const confirmed = await confirmPesapalPayment(orderTrackingId, tx.transactionId);
  const [updated] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  res.json({ confirmed, transaction: toTxResponse(updated) });
});

router.post("/redeem-voucher", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { code } = req.body;
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Voucher code is required" });
    return;
  }
  const normalized = code.replace(/[-\s]/g, "").toUpperCase().trim();
  const [voucher] = await db.select().from(vouchersTable).where(eq(vouchersTable.code, normalized)).limit(1);
  if (!voucher) { res.status(404).json({ error: "Invalid voucher code" }); return; }
  if (voucher.isRedeemed) { res.status(400).json({ error: "This voucher has already been redeemed" }); return; }

  const amount = parseFloat(voucher.amount as string);
  const now = new Date();

  await db.update(vouchersTable).set({ isRedeemed: true, redeemedBy: req.userId!, redeemedAt: now }).where(eq(vouchersTable.id, voucher.id));
  await db.update(walletsTable).set({
    balance: sql`balance + ${amount}`,
    availableBalance: sql`available_balance + ${amount}`,
    withdrawableBalance: sql`withdrawable_balance + ${amount}`,
  }).where(eq(walletsTable.userId, req.userId!));

  const [tx] = await db.insert(transactionsTable).values({
    transactionId: `VCH-${voucher.code}`,
    userId: req.userId!,
    type: "voucher_redeem",
    amount: String(amount),
    status: "completed",
    paymentMethod: "internal",
    description: `Voucher ${voucher.code} redeemed`,
  }).returning();

  await notify(req.userId!, "deposit_received", "Voucher Redeemed", `$${amount.toFixed(2)} has been added to your wallet.`);
  res.json({ success: true, amount, transaction: toTxResponse(tx) });
});

router.get("/admin/wallets", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(walletsTable);
  const wallets = await db.select().from(walletsTable).limit(limit).offset(offset);
  res.json({ wallets: wallets.map(toWalletResponse), total: Number(count), page, limit });
});

// ── PAWAPAY ──────────────────────────────────────────────────────────────────

router.post("/pawapay/deposit", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { amount, phoneNumber, provider } = req.body;
  if (!amount || Number(amount) <= 0) { res.status(400).json({ error: "Invalid amount" }); return; }
  if (!phoneNumber || !provider) { res.status(400).json({ error: "phoneNumber and provider are required" }); return; }

  if (!(await isGatewayEnabled("pawapay"))) {
    res.status(503).json({ error: "PawaPay is temporarily unavailable. Please try another payment method or contact support." });
    return;
  }

  const config = await getPawapayConfig();
  if (!config) { res.status(503).json({ error: "PawaPay is not configured. Contact admin." }); return; }

  const depositId = uuidv4();
  const [tx] = await db.insert(transactionsTable).values({
    transactionId: depositId,
    userId: req.userId!,
    type: "deposit",
    amount: Number(amount).toFixed(2),
    status: "pending",
    paymentMethod: "pawapay",
    description: `PawaPay deposit (${config.currency} ${(Number(amount) * config.exchangeRate).toFixed(0)})`,
    metadata: JSON.stringify({ depositId, provider, phoneNumber }),
  }).returning();

  try {
    const host = `${req.protocol}://${req.get("host")}`;
    const result = await pawapayInitiateDeposit(config, {
      depositId,
      amount: Number(amount),
      phoneNumber,
      provider,
      callbackUrl: `${host}/api/wallet/pawapay/callback/deposit`,
      clientReferenceId: tx.transactionId,
    });

    if (result.status === "REJECTED") {
      await db.update(transactionsTable).set({ status: "failed" }).where(eq(transactionsTable.id, tx.id));
      res.status(400).json({ error: result.failureReason?.failureMessage || "Deposit rejected by provider" });
      return;
    }

    res.status(201).json({ depositId, status: result.status });
  } catch (err: any) {
    await db.update(transactionsTable).set({ status: "failed" }).where(eq(transactionsTable.id, tx.id));
    req.log.error({ err }, "PawaPay deposit initiation error");
    res.status(502).json({ error: err.message || "Payment gateway error" });
  }
});

router.get("/pawapay/deposit/status", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { depositId } = req.query;
  if (!depositId) { res.status(400).json({ error: "depositId required" }); return; }
  const [tx] = await db.select().from(transactionsTable)
    .where(and(eq(transactionsTable.transactionId, depositId as string), eq(transactionsTable.userId, req.userId!)))
    .limit(1);
  if (!tx) { res.status(404).json({ error: "Transaction not found" }); return; }
  res.json({ status: tx.status, amount: parseFloat(tx.amount as string) });
});

router.post("/pawapay/callback/deposit", async (req, res): Promise<void> => {
  res.status(200).json({ ok: true }); // Acknowledge immediately
  const { depositId, status } = req.body as { depositId?: string; status?: string };
  if (!depositId || !status) return;

  const [tx] = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.transactionId, depositId)).limit(1);
  if (!tx || tx.status !== "pending") return;

  if (status === "COMPLETED") {
    await db.update(transactionsTable).set({ status: "completed" }).where(eq(transactionsTable.id, tx.id));
    const amt = parseFloat(tx.amount as string);
    await db.update(walletsTable).set({
      balance: sql`balance + ${amt}`,
      availableBalance: sql`available_balance + ${amt}`,
      withdrawableBalance: sql`withdrawable_balance + ${amt}`,
    }).where(eq(walletsTable.userId, tx.userId));
    await notify(tx.userId, "deposit_received", "Deposit Confirmed", `$${amt.toFixed(2)} credited to your wallet via PawaPay.`);
    const matchingPromo = await findMatchingAutoPromo(amt);
    if (matchingPromo) {
      const already = await db.select().from(promotionTermsAcceptanceTable)
        .where(and(eq(promotionTermsAcceptanceTable.userId, tx.userId), eq(promotionTermsAcceptanceTable.promotionId, matchingPromo.id))).limit(1);
      if (!already.length) {
        await notify(tx.userId, "deposit_received", "🎁 Bonus Waiting!", `Go to your Wallet to claim your bonus.`);
      } else {
        await creditBonus(tx.userId, matchingPromo, amt);
      }
    }
    logger.info({ depositId }, "PawaPay deposit confirmed via callback");
  } else if (status === "FAILED" || status === "CANCELLED") {
    await db.update(transactionsTable).set({ status: "failed" }).where(eq(transactionsTable.id, tx.id));
    logger.info({ depositId, status }, "PawaPay deposit failed");
  }
});

router.post("/pawapay/callback/payout", async (req, res): Promise<void> => {
  res.status(200).json({ ok: true }); // Acknowledge immediately
  const { payoutId, status } = req.body as { payoutId?: string; status?: string };
  if (!payoutId || !status) return;

  const [tx] = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.transactionId, payoutId)).limit(1);
  if (!tx) return;

  if (status === "COMPLETED" && tx.status === "approved") {
    await db.update(transactionsTable).set({ status: "completed" }).where(eq(transactionsTable.id, tx.id));
    await db.update(walletsTable).set({
      balance: sql`balance - ${parseFloat(tx.amount as string)}`,
      pendingBalance: sql`pending_balance - ${parseFloat(tx.amount as string)}`,
    }).where(eq(walletsTable.userId, tx.userId));
    await notify(tx.userId, "withdrawal_approved", "Withdrawal Sent", `$${parseFloat(tx.amount as string).toFixed(2)} has been sent to your mobile money account.`);
    logger.info({ payoutId }, "PawaPay payout completed");
  } else if ((status === "FAILED" || status === "CANCELLED") && (tx.status === "approved" || tx.status === "pending")) {
    await db.update(transactionsTable).set({ status: "rejected" }).where(eq(transactionsTable.id, tx.id));
    const amt = parseFloat(tx.amount as string);
    await db.update(walletsTable).set({
      withdrawableBalance: sql`withdrawable_balance + ${amt}`,
      availableBalance: sql`available_balance + ${amt}`,
      pendingBalance: sql`pending_balance - ${amt}`,
    }).where(eq(walletsTable.userId, tx.userId));
    await notify(tx.userId, "withdrawal_rejected", "Withdrawal Failed", `Your withdrawal of $${parseFloat(tx.amount as string).toFixed(2)} via PawaPay failed. Funds returned to wallet.`);
    logger.warn({ payoutId, status }, "PawaPay payout failed — funds returned");
  }
});

router.post("/pawapay/callback/refund", async (req, res): Promise<void> => {
  res.status(200).json({ ok: true }); // Acknowledge immediately
  const { refundId, depositId, status, amount } = req.body as {
    refundId?: string;
    depositId?: string;
    status?: string;
    amount?: number;
  };

  logger.info({ refundId, depositId, status, amount }, "PawaPay refund callback received");

  if (!depositId || !status) return;

  // Find the original deposit transaction
  const [tx] = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.transactionId, depositId)).limit(1);
  if (!tx) {
    logger.warn({ refundId, depositId }, "PawaPay refund: original deposit transaction not found");
    return;
  }

  if (status === "COMPLETED") {
    const refundAmt = amount ? parseFloat(String(amount)) : parseFloat(tx.amount as string);
    // Deduct refunded amount from wallet
    await db.update(walletsTable).set({
      balance: sql`balance - ${refundAmt}`,
      withdrawableBalance: sql`withdrawable_balance - ${refundAmt}`,
      availableBalance: sql`available_balance - ${refundAmt}`,
    }).where(eq(walletsTable.userId, tx.userId));
    await notify(tx.userId, "deposit_received", "Deposit Refunded", `A refund of $${refundAmt.toFixed(2)} has been processed on your account.`);
    logger.info({ refundId, depositId, refundAmt }, "PawaPay refund completed");
  } else if (status === "FAILED" || status === "CANCELLED") {
    logger.warn({ refundId, depositId, status }, "PawaPay refund failed or cancelled");
  }
});

router.post("/pawapay/withdraw", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { amount, phoneNumber, provider } = req.body;
  if (!amount || Number(amount) <= 0) { res.status(400).json({ error: "Invalid amount" }); return; }
  if (!phoneNumber || !provider) { res.status(400).json({ error: "phoneNumber and provider are required" }); return; }

  const config = await getPawapayConfig();
  if (!config) { res.status(503).json({ error: "PawaPay is not configured. Contact admin." }); return; }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.userId!)).limit(1);
  if (!wallet || parseFloat(wallet.withdrawableBalance as string) < Number(amount)) {
    res.status(400).json({ error: "Insufficient withdrawable balance" });
    return;
  }

  await db.update(walletsTable).set({
    withdrawableBalance: sql`withdrawable_balance - ${Number(amount)}`,
    availableBalance: sql`available_balance - ${Number(amount)}`,
    pendingBalance: sql`pending_balance + ${Number(amount)}`,
  }).where(eq(walletsTable.userId, req.userId!));

  const payoutId = uuidv4();
  const [tx] = await db.insert(transactionsTable).values({
    transactionId: payoutId,
    userId: req.userId!,
    type: "withdrawal",
    amount: Number(amount).toFixed(2),
    status: "approved",
    paymentMethod: "pawapay",
    reference: phoneNumber,
    description: `Instant withdrawal via PawaPay (${provider}) to ${phoneNumber}`,
  }).returning();

  try {
    await pawapayInitiatePayout(config, {
      payoutId,
      amount: Number(amount),
      phoneNumber,
      provider,
    });
    res.status(201).json({ ...toTxResponse(tx), instant: true });
  } catch (err: any) {
    await db.update(transactionsTable).set({ status: "failed" }).where(eq(transactionsTable.id, tx.id));
    await db.update(walletsTable).set({
      withdrawableBalance: sql`withdrawable_balance + ${Number(amount)}`,
      availableBalance: sql`available_balance + ${Number(amount)}`,
      pendingBalance: sql`pending_balance - ${Number(amount)}`,
    }).where(eq(walletsTable.userId, req.userId!));
    req.log.error({ err }, "PawaPay instant withdraw error");
    res.status(502).json({ error: err.message || "Payout gateway error. Please try again." });
  }
});

router.get("/pawapay/status", async (_req, res): Promise<void> => {
  const config = await getPawapayConfig();
  res.json({ configured: !!config, environment: config?.environment ?? null });
});

router.get("/gateway-status", async (_req, res): Promise<void> => {
  const [pawapayConfig, pesapalEnabled, pawapayEnabled] = await Promise.all([
    getPawapayConfig(),
    isGatewayEnabled("pesapal"),
    isGatewayEnabled("pawapay"),
  ]);
  res.json({
    pesapalEnabled,
    pawapayEnabled,
    pawapayConfigured: !!pawapayConfig,
  });
});

// ── PESAPAL ──────────────────────────────────────────────────────────────────

router.post("/pesapal/initiate", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { amount } = req.body;
  if (!amount || Number(amount) <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  if (!(await isGatewayEnabled("pesapal"))) {
    res.status(503).json({ error: "Pesapal is temporarily unavailable. Please try another payment method or contact support." });
    return;
  }

  const config = await getPesapalConfig();
  if (!config) {
    res.status(503).json({ error: "Pesapal payment gateway is not configured. Contact admin." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const merchantRef = `DEP-${uuidv4().split("-")[0].toUpperCase()}`;

  const [tx] = await db
    .insert(transactionsTable)
    .values({
      transactionId: merchantRef,
      userId: req.userId!,
      type: "deposit",
      amount: Number(amount).toFixed(2),
      status: "pending",
      paymentMethod: "pesapal",
      description: `Pesapal deposit of ${config.currency} ${amount}`,
    })
    .returning();

  try {
    const token = await getAccessToken(config);
    const host = `${req.protocol}://${req.get("host")}`;
    const ipnUrl = `${host}/api/wallet/pesapal/ipn`;
    const callbackUrl = `${host}/api/wallet/pesapal/callback`;
    const ipnId = await ensureIPN(config, token, ipnUrl);

    const order = await submitOrder(config, token, {
      merchantRef,
      amount: Number(amount),
      currency: config.currency,
      callbackUrl,
      notificationId: ipnId,
      firstName: user.fullName?.split(" ")[0] || "",
      lastName: user.fullName?.split(" ").slice(1).join(" ") || "",
      email: user.email,
      phone: user.phone || "",
    });

    await db
      .update(transactionsTable)
      .set({ reference: order.orderTrackingId, metadata: JSON.stringify({ orderTrackingId: order.orderTrackingId }) })
      .where(eq(transactionsTable.id, tx.id));

    res.status(201).json({ redirectUrl: order.redirectUrl, transactionId: merchantRef, orderTrackingId: order.orderTrackingId });
  } catch (err: any) {
    await db.update(transactionsTable).set({ status: "failed" }).where(eq(transactionsTable.id, tx.id));
    req.log.error({ err }, "Pesapal initiate error");
    res.status(502).json({ error: err.message || "Payment gateway error" });
  }
});

async function confirmPesapalPayment(orderTrackingId: string, merchantRef: string): Promise<boolean> {
  const config = await getPesapalConfig();
  if (!config) return false;

  try {
    const token = await getAccessToken(config);
    const status = await getTransactionStatus(config, token, orderTrackingId);

    if (status.statusCode === 2 || status.statusCode === 3) {
      // Payment failed/reversed — mark failed only if still pending (idempotent)
      await db
        .update(transactionsTable)
        .set({ status: "failed" })
        .where(and(eq(transactionsTable.transactionId, merchantRef), eq(transactionsTable.status, "pending")));
      return false;
    }

    if (status.statusCode !== 1) {
      // Still processing or unknown — leave as pending
      return false;
    }

    // Atomically claim the pending→completed transition.
    // If callback and IPN fire concurrently, only one UPDATE will match
    // (the other finds status already 'completed') — preventing double-credit.
    const [updated] = await db
      .update(transactionsTable)
      .set({ status: "completed", reference: orderTrackingId })
      .where(and(eq(transactionsTable.transactionId, merchantRef), eq(transactionsTable.status, "pending")))
      .returning();

    if (!updated) {
      // Another concurrent call already completed this transaction
      return true;
    }

    const amt = parseFloat(updated.amount as string);
    await db.update(walletsTable).set({
      balance: sql`balance + ${amt}`,
      availableBalance: sql`available_balance + ${amt}`,
      withdrawableBalance: sql`withdrawable_balance + ${amt}`,
    }).where(eq(walletsTable.userId, updated.userId));

    await notify(updated.userId, "deposit_received", "Deposit Confirmed", `${amt.toFixed(2)} has been added to your wallet via Pesapal.`);

    // Check for matching automatic promotions
    const matchingPromo = await findMatchingAutoPromo(amt);
    if (matchingPromo) {
      const alreadyAccepted = await db.select().from(promotionTermsAcceptanceTable).where(
        and(eq(promotionTermsAcceptanceTable.userId, updated.userId), eq(promotionTermsAcceptanceTable.promotionId, matchingPromo.id))
      ).limit(1);
      if (!alreadyAccepted.length) {
        await notify(updated.userId, "deposit_received", "🎁 Bonus Waiting!",
          `You qualify for a bonus from "${matchingPromo.name}"! Go to your Wallet to claim it.`);
      } else {
        await creditBonus(updated.userId, matchingPromo, amt);
      }
    }

    logger.info({ merchantRef, orderTrackingId }, "Pesapal deposit confirmed");
    return true;
  } catch (err) {
    logger.error({ err, orderTrackingId }, "Pesapal confirmation error");
    return false;
  }
}

router.get("/pesapal/callback", async (req, res): Promise<void> => {
  const orderTrackingId = req.query["OrderTrackingId"] as string;
  const merchantRef = req.query["OrderMerchantReference"] as string;

  if (!orderTrackingId || !merchantRef) {
    res.redirect("/?payment=error");
    return;
  }

  const success = await confirmPesapalPayment(orderTrackingId, merchantRef);
  res.redirect(`/wallet?payment=${success ? "success" : "pending"}&ref=${merchantRef}`);
});

router.get("/pesapal/ipn", async (req, res): Promise<void> => {
  const orderTrackingId = req.query["orderTrackingId"] as string;
  const merchantRef = req.query["orderMerchantReference"] as string;

  if (orderTrackingId && merchantRef) {
    await confirmPesapalPayment(orderTrackingId, merchantRef).catch((err) =>
      logger.error({ err }, "IPN confirmation error")
    );
  }

  res.json({ orderNotificationType: "IPNCHANGE", orderTrackingId, orderMerchantReference: merchantRef, status: 200 });
});

router.get("/pesapal/status", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { ref } = req.query;
  if (!ref) { res.status(400).json({ error: "ref required" }); return; }

  const [tx] = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.transactionId, ref as string))
    .limit(1);

  if (!tx || tx.userId !== req.userId) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  res.json({ status: tx.status, amount: parseFloat(tx.amount as string) });
});

router.post("/admin/adjust", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const { userId, amount, type, description } = req.body;
  if (!userId || !amount || !type) {
    res.status(400).json({ error: "userId, amount, type required" });
    return;
  }
  if (!["credit", "debit"].includes(type)) {
    res.status(400).json({ error: "type must be 'credit' or 'debit'" });
    return;
  }
  const amt = parseFloat(String(amount));
  if (isNaN(amt) || amt <= 0) {
    res.status(400).json({ error: "amount must be a positive number" });
    return;
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, Number(userId))).limit(1);
  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  if (type === "debit") {
    const available = parseFloat(wallet.availableBalance as string);
    if (available < amt) {
      res.status(400).json({ error: `Insufficient balance. Available: $${available.toFixed(2)}` });
      return;
    }
    await db.update(walletsTable).set({
      balance: sql`balance - ${amt}`,
      availableBalance: sql`available_balance - ${amt}`,
      withdrawableBalance: sql`GREATEST(withdrawable_balance - ${amt}, 0)`,
    }).where(eq(walletsTable.userId, Number(userId)));
  } else {
    await db.update(walletsTable).set({
      balance: sql`balance + ${amt}`,
      availableBalance: sql`available_balance + ${amt}`,
      withdrawableBalance: sql`withdrawable_balance + ${amt}`,
    }).where(eq(walletsTable.userId, Number(userId)));
  }

  await db.insert(transactionsTable).values({
    transactionId: `ADJ-${uuidv4().split("-")[0].toUpperCase()}`,
    userId: Number(userId),
    type: type === "credit" ? "deposit" : "withdrawal",
    amount: amt.toString(),
    status: "completed",
    paymentMethod: "internal",
    description: description || `Admin manual ${type}`,
  });

  await notify(Number(userId), type === "credit" ? "deposit_received" : "withdrawal_approved",
    type === "credit" ? "Wallet Credited" : "Wallet Debited",
    `Your wallet has been ${type === "credit" ? "credited" : "debited"} $${amt.toFixed(2)} by admin.`
  );

  const [updated] = await db.select().from(walletsTable).where(eq(walletsTable.userId, Number(userId))).limit(1);
  res.json({ wallet: toWalletResponse(updated) });
});

export default router;
