import { Router } from "express";
import { db, transactionsTable, walletsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { notify } from "../lib/notify";

const router = Router();

/** Google Play consumables sold through RevenueCat. Amounts are in USD. */
const CREDIT_TIERS: Record<string, number> = {
  ata_credit_1: 1,
  ata_credit_2: 2,
  ata_credit_5: 5,
  ata_credit_10: 10,
  ata_credit_20: 20,
  ata_credit_50: 50,
};

const CREDIT_EVENTS = new Set(["INITIAL_PURCHASE", "PRODUCT_CHANGE", "UNCANCELLATION"]);

interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  product_id?: string;
  transaction_id?: string;
  id?: string;
}

/**
 * RevenueCat calls this after a verified Google Play purchase. Never trust the
 * client to credit the wallet — only this signed webhook does.
 * Set REVENUECAT_WEBHOOK_SECRET on the API server.
 */
router.post("/revenuecat", async (req, res): Promise<void> => {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn("RevenueCat webhook: no secret configured — rejecting");
    res.status(503).json({ error: "Webhook not configured" });
    return;
  }

  const header = req.headers.authorization ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (provided !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const event = (req.body ?? {}) as RevenueCatEvent;
  if (!event.type || !CREDIT_EVENTS.has(event.type)) {
    res.json({ ok: true, ignored: true });
    return;
  }

  const amount = CREDIT_TIERS[event.product_id ?? ""];
  const userId = Number(event.app_user_id);
  const reference = event.transaction_id ?? event.id;
  if (!amount || !Number.isInteger(userId) || userId <= 0 || !reference) {
    logger.warn({ productId: event.product_id, appUserId: event.app_user_id }, "RevenueCat webhook: unmapped product or user");
    res.status(400).json({ error: "Unrecognized purchase" });
    return;
  }

  // transactionId is unique in the DB, so replayed webhooks cannot credit twice.
  const transactionId = `IAP-${reference}`;
  const existing = await db.select({ id: transactionsTable.id })
    .from(transactionsTable).where(eq(transactionsTable.transactionId, transactionId)).limit(1);
  if (existing.length) {
    res.json({ ok: true, duplicate: true });
    return;
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  await db.insert(transactionsTable).values({
    transactionId,
    userId,
    type: "deposit",
    amount: amount.toFixed(2),
    status: "completed",
    paymentMethod: "internal",
    reference,
    description: `Google Play credit (${event.product_id})`,
  });
  await db.update(walletsTable).set({
    balance: sql`balance + ${amount}`,
    availableBalance: sql`available_balance + ${amount}`,
    withdrawableBalance: sql`withdrawable_balance + ${amount}`,
  }).where(eq(walletsTable.userId, userId));

  await notify(userId, "deposit_received", "Wallet credited", `$${amount.toFixed(2)} was added to your wallet from Google Play.`);
  logger.info({ userId, amount, productId: event.product_id, transactionId }, "RevenueCat credit applied");
  res.json({ ok: true, credited: amount });
});

export default router;
