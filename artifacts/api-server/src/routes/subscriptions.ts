import { Router } from "express";
import { eq, and, gt, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "@workspace/db";
import {
  platformSubscriptionsTable,
  walletsTable,
  transactionsTable,
  bonusTransactionsTable,
} from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";

const router = Router();

// ── GET /api/subscriptions/prices ─────────────────────────────────────────
router.get("/prices", async (_req, res): Promise<void> => {
  const priceRows = await db.execute(
    sql`SELECT key, value FROM settings WHERE key IN ('price_daily','price_weekly','price_monthly','price_yearly')`
  );
  const priceMap: Record<string, string> = {};
  for (const r of priceRows.rows as { key: string; value: string }[]) {
    priceMap[r.key] = r.value;
  }
  const parsePriceSafe = (raw: string | undefined, fallback: number): number => {
    const n = parseFloat(raw ?? "");
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  res.json({
    daily:   parsePriceSafe(priceMap["price_daily"],   1.70),
    weekly:  parsePriceSafe(priceMap["price_weekly"],  7.00),
    monthly: parsePriceSafe(priceMap["price_monthly"], 20.00),
    yearly:  parsePriceSafe(priceMap["price_yearly"],  99.00),
  });
});

// ── GET /api/subscriptions/active ─────────────────────────────────────────
router.get("/active", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;
  const now = new Date();
  const [active] = await db
    .select()
    .from(platformSubscriptionsTable)
    .where(
      and(
        eq(platformSubscriptionsTable.userId, userId),
        gt(platformSubscriptionsTable.expiresAt, now)
      )
    )
    .orderBy(sql`expires_at DESC`)
    .limit(1);

  if (!active) {
    res.json({ hasSubscription: false });
    return;
  }
  res.json({
    hasSubscription: true,
    subscriptionType: active.subscriptionType,
    expiresAt: active.expiresAt,
    secondsRemaining: Math.floor((active.expiresAt.getTime() - now.getTime()) / 1000),
  });
});

// ── POST /api/subscriptions/purchase ──────────────────────────────────────
router.post("/purchase", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;

  const subType: "daily" | "weekly" | "monthly" | "yearly" = [
    "daily", "weekly", "monthly", "yearly",
  ].includes(req.body?.subscriptionType)
    ? req.body.subscriptionType
    : "daily";

  // Load prices from settings
  const priceRows = await db.execute(
    sql`SELECT key, value FROM settings WHERE key IN ('price_daily','price_weekly','price_monthly','price_yearly')`
  );
  const priceMap: Record<string, string> = {};
  for (const r of priceRows.rows as { key: string; value: string }[]) {
    priceMap[r.key] = r.value;
  }
  const parsePriceSafe = (raw: string | undefined, fallback: number): number => {
    const n = parseFloat(raw ?? "");
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const PRICES: Record<string, number> = {
    daily:   parsePriceSafe(priceMap["price_daily"],   1.70),
    weekly:  parsePriceSafe(priceMap["price_weekly"],  7.00),
    monthly: parsePriceSafe(priceMap["price_monthly"], 20.00),
    yearly:  parsePriceSafe(priceMap["price_yearly"],  99.00),
  };
  const DURATIONS_MS: Record<string, number> = {
    daily:   1   * 24 * 60 * 60 * 1000,
    weekly:  7   * 24 * 60 * 60 * 1000,
    monthly: 30  * 24 * 60 * 60 * 1000,
    yearly:  365 * 24 * 60 * 60 * 1000,
  };
  const DURATION_LABELS: Record<string, string> = {
    daily: "24-hour", weekly: "7-day", monthly: "30-day", yearly: "365-day",
  };

  const price = PRICES[subType];
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DURATIONS_MS[subType]);
  const txId = `SUB-${uuidv4().split("-")[0].toUpperCase()}`;
  const durationLabel = DURATION_LABELS[subType];

  // All checks AND writes inside one transaction with row-level lock on the
  // wallet row, preventing double-purchase and over-debit under concurrency.
  let result: { hasSubscription: boolean; subscriptionType: string; expiresAt: Date; secondsRemaining: number; amount: number } | null = null;

  await db.transaction(async (tx) => {
    // Row-lock the wallet to serialise concurrent purchase attempts
    const [wallet] = await tx.execute(
      sql`SELECT * FROM wallets WHERE user_id = ${userId} FOR UPDATE`
    ).then((r) => r.rows as any[]);

    if (!wallet) {
      res.status(402).json({ error: "Wallet not found" });
      return;
    }

    const cashAvailable = parseFloat(wallet.available_balance || "0");
    const bonusAvailable = parseFloat(wallet.bonus_balance || "0");
    const totalAvailable = cashAvailable + bonusAvailable;

    if (totalAvailable < price) {
      res.status(402).json({ error: "Insufficient wallet balance" });
      return;
    }

    // Check for existing active subscription while holding the lock
    const [existing] = await tx.execute(
      sql`SELECT id, expires_at, subscription_type FROM platform_subscriptions WHERE user_id = ${userId} AND expires_at > ${now} ORDER BY expires_at DESC LIMIT 1`
    ).then((r) => r.rows as any[]);

    if (existing) {
      res.status(409).json({
        error: "You already have an active subscription.",
        expiresAt: existing.expires_at,
        subscriptionType: existing.subscription_type,
      });
      return;
    }

    // Bonus first, then cash
    const bonusUsed = Math.min(bonusAvailable, price);
    const cashUsed = Math.round((price - bonusUsed) * 100) / 100;
    const descText = bonusUsed > 0
      ? `${durationLabel} platform subscription (bonus $${bonusUsed.toFixed(2)} + cash $${cashUsed.toFixed(2)})`
      : `${durationLabel} platform subscription`;

    if (bonusUsed > 0) {
      await tx.update(walletsTable).set({
        bonusBalance: sql`bonus_balance - ${bonusUsed}`,
      }).where(eq(walletsTable.userId, userId));

      await tx.insert(bonusTransactionsTable).values({
        userId,
        type: "used",
        amount: bonusUsed.toFixed(2),
        balanceBefore: bonusAvailable.toFixed(2),
        balanceAfter: (bonusAvailable - bonusUsed).toFixed(2),
        description: `Bonus used for: ${durationLabel} platform subscription`,
      });
    }

    if (cashUsed > 0) {
      const updated = await tx.execute(
        sql`UPDATE wallets SET balance = balance - ${cashUsed}, available_balance = available_balance - ${cashUsed}, withdrawable_balance = withdrawable_balance - ${cashUsed} WHERE user_id = ${userId} AND available_balance >= ${cashUsed} RETURNING id`
      ).then((r) => r.rows as any[]);

      if (!updated.length) {
        res.status(402).json({ error: "Insufficient available balance" });
        return;
      }
    }

    await tx.insert(transactionsTable).values({
      transactionId: txId,
      userId,
      type: "stream_access",
      amount: price.toString(),
      status: "completed",
      paymentMethod: "internal",
      description: descText,
    });

    await tx.insert(platformSubscriptionsTable).values({
      userId,
      subscriptionType: subType,
      grantedAt: now,
      expiresAt,
      amount: price.toFixed(2),
      transactionId: txId,
    });

    result = {
      hasSubscription: true,
      subscriptionType: subType,
      expiresAt,
      secondsRemaining: Math.floor(DURATIONS_MS[subType] / 1000),
      amount: price,
    };
  });

  if (result) res.json(result);
});

export default router;
