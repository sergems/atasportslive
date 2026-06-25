import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, walletsTable, transactionsTable, usersTable, vouchersTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { notify } from "../lib/notify";
import { logger } from "../lib/logger";
import {
  getPesapalConfig,
  getAccessToken,
  ensureIPN,
  submitOrder,
  getTransactionStatus,
} from "../lib/pesapal";

const router = Router();

const toWalletResponse = (w: typeof walletsTable.$inferSelect) => ({
  id: w.id,
  userId: w.userId,
  balance: parseFloat(w.balance as string),
  availableBalance: parseFloat(w.availableBalance as string),
  pendingBalance: parseFloat(w.pendingBalance as string),
  withdrawableBalance: parseFloat(w.withdrawableBalance as string),
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

  const updatedTx = await db.select().from(transactionsTable).where(eq(transactionsTable.id, tx.id)).limit(1);
  res.status(201).json(toTxResponse(updatedTx[0]));
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

  // Must have a verified payout method
  const userRows = await db.execute(
    sql`SELECT payout_method, payout_account, payout_method_set_at FROM users WHERE id = ${req.userId}`
  );
  const userRow = (userRows.rows?.[0] as any) ?? null;
  if (!userRow?.payout_method || !userRow?.payout_account) {
    res.status(400).json({ error: "You must set a payout method before withdrawing." });
    return;
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.userId!)).limit(1);
  if (!wallet || parseFloat(wallet.withdrawableBalance as string) < Number(amount)) {
    res.status(400).json({ error: "Insufficient withdrawable balance" });
    return;
  }

  // Lock funds
  await db.update(walletsTable).set({
    withdrawableBalance: sql`withdrawable_balance - ${Number(amount)}`,
    availableBalance: sql`available_balance - ${Number(amount)}`,
    pendingBalance: sql`pending_balance + ${Number(amount)}`,
  }).where(eq(walletsTable.userId, req.userId!));

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

  res.json({ transactions: txs.map((t) => toTxResponse(t)), total: Number(count), page, limit });
});

router.patch("/admin/approve-withdrawal/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!tx || tx.type !== "withdrawal" || tx.status !== "pending") {
    res.status(400).json({ error: "Invalid withdrawal" });
    return;
  }
  await db.update(transactionsTable).set({ status: "completed" }).where(eq(transactionsTable.id, id));
  await db.update(walletsTable).set({
    balance: sql`balance - ${parseFloat(tx.amount as string)}`,
    pendingBalance: sql`pending_balance - ${parseFloat(tx.amount as string)}`,
  }).where(eq(walletsTable.userId, tx.userId));

  await notify(tx.userId, "withdrawal_approved", "Withdrawal Approved", `Your withdrawal of $${tx.amount} has been approved.`);
  const [updated] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  res.json(toTxResponse(updated));
});

router.patch("/admin/reject-withdrawal/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
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
  const [updated] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  res.json(toTxResponse(updated));
});

router.patch("/admin/deposit/:id/confirm", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!tx || tx.type !== "deposit" || tx.status !== "pending") {
    res.status(400).json({ error: "Invalid deposit" });
    return;
  }
  await db.update(transactionsTable).set({ status: "completed" }).where(eq(transactionsTable.id, id));
  await db.update(walletsTable).set({
    balance: sql`balance + ${parseFloat(tx.amount as string)}`,
    availableBalance: sql`available_balance + ${parseFloat(tx.amount as string)}`,
    withdrawableBalance: sql`withdrawable_balance + ${parseFloat(tx.amount as string)}`,
  }).where(eq(walletsTable.userId, tx.userId));
  await notify(tx.userId, "deposit_received", "Deposit Confirmed", `$${tx.amount} has been added to your wallet.`);
  const [updated] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  res.json(toTxResponse(updated));
});

router.post("/redeem-voucher", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { code } = req.body;
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Voucher code is required" });
    return;
  }
  const [voucher] = await db.select().from(vouchersTable).where(eq(vouchersTable.code, code.trim())).limit(1);
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

router.get("/admin/wallets", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(walletsTable);
  const wallets = await db.select().from(walletsTable).limit(limit).offset(offset);
  res.json({ wallets: wallets.map(toWalletResponse), total: Number(count), page, limit });
});

// ── PESAPAL ──────────────────────────────────────────────────────────────────

router.post("/pesapal/initiate", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { amount } = req.body;
  if (!amount || Number(amount) <= 0) {
    res.status(400).json({ error: "Invalid amount" });
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

  const [tx] = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.transactionId, merchantRef))
    .limit(1);

  if (!tx || tx.status !== "pending") return false;

  try {
    const token = await getAccessToken(config);
    const status = await getTransactionStatus(config, token, orderTrackingId);

    if (status.statusCode === 1) {
      await db.update(transactionsTable).set({ status: "completed", reference: orderTrackingId }).where(eq(transactionsTable.id, tx.id));
      const amt = parseFloat(tx.amount as string);
      await db.update(walletsTable).set({
        balance: sql`balance + ${amt}`,
        availableBalance: sql`available_balance + ${amt}`,
        withdrawableBalance: sql`withdrawable_balance + ${amt}`,
      }).where(eq(walletsTable.userId, tx.userId));

      await notify(tx.userId, "deposit_received", "Deposit Confirmed", `$${amt.toFixed(2)} has been added to your wallet via Pesapal.`);
      logger.info({ merchantRef, orderTrackingId }, "Pesapal deposit confirmed");
      return true;
    } else if (status.statusCode === 2 || status.statusCode === 3) {
      await db.update(transactionsTable).set({ status: "failed" }).where(eq(transactionsTable.id, tx.id));
    }
    return false;
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

export default router;
