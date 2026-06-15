import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, walletsTable, transactionsTable, usersTable, vouchersTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { notify } from "../lib/notify";

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

router.post("/withdraw", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { amount, paymentMethod, accountDetails } = req.body;
  if (!amount || amount <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }
  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.userId!)).limit(1);
  if (!wallet || parseFloat(wallet.withdrawableBalance as string) < amount) {
    res.status(400).json({ error: "Insufficient withdrawable balance" });
    return;
  }
  // Lock funds
  await db.update(walletsTable).set({
    withdrawableBalance: sql`withdrawable_balance - ${amount}`,
    availableBalance: sql`available_balance - ${amount}`,
    pendingBalance: sql`pending_balance + ${amount}`,
  }).where(eq(walletsTable.userId, req.userId!));

  const [tx] = await db
    .insert(transactionsTable)
    .values({
      transactionId: `WIT-${uuidv4().split("-")[0].toUpperCase()}`,
      userId: req.userId!,
      type: "withdrawal",
      amount: amount.toString(),
      status: "pending",
      paymentMethod,
      reference: accountDetails,
      description: `Withdrawal via ${paymentMethod}`,
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

  await notify(tx.userId, "withdrawal_rejected", "Withdrawal Rejected", `Your withdrawal of $${tx.amount} has been rejected.`);
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

export default router;
