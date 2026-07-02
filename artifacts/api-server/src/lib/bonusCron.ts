import { db, walletsTable, bonusTransactionsTable, notificationsTable } from "@workspace/db";
import { eq, and, lt, gte, lte, isNotNull, sql, not, exists } from "drizzle-orm";
import { notify } from "./notify";
import { logger } from "./logger";

const HOUR_MS = 60 * 60 * 1000;

async function expireOldBonuses(): Promise<void> {
  const now = new Date();

  // Find earned bonuses that have expired and haven't been processed yet.
  // "Not yet processed" = no `expired` record whose reference = 'EXP-' + original reference.
  const expiredEarned = await db.execute(sql`
    SELECT bt.*
    FROM bonus_transactions bt
    WHERE bt.type = 'earned'
      AND bt.expires_at IS NOT NULL
      AND bt.expires_at < ${now}
      AND bt.reference IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM bonus_transactions exp
        WHERE exp.type = 'expired'
          AND exp.reference = 'EXP-' || bt.reference
          AND exp.user_id = bt.user_id
      )
  `);

  const rows = expiredEarned.rows as Array<{
    id: number;
    user_id: number;
    promotion_id: number | null;
    amount: string;
    reference: string;
    expires_at: string;
  }>;

  if (rows.length === 0) return;

  logger.info({ count: rows.length }, "Processing expired bonuses");

  for (const row of rows) {
    try {
      const [wallet] = await db
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.userId, row.user_id))
        .limit(1);

      if (!wallet) continue;

      const currentBonus = parseFloat((wallet.bonusBalance as string) || "0");
      if (currentBonus <= 0) {
        // Balance already zero — still record the expiry for auditing
        await db.insert(bonusTransactionsTable).values({
          userId: row.user_id,
          promotionId: row.promotion_id,
          type: "expired",
          amount: "0",
          balanceBefore: "0",
          balanceAfter: "0",
          reference: `EXP-${row.reference}`,
          description: `Bonus expired (balance already zero)`,
        });
        continue;
      }

      const earned = parseFloat(row.amount);
      const deduct = Math.min(earned, currentBonus);
      const balAfter = Math.max(0, currentBonus - deduct);

      await db
        .update(walletsTable)
        .set({ bonusBalance: sql`GREATEST(0, bonus_balance - ${deduct})` })
        .where(eq(walletsTable.userId, row.user_id));

      await db.insert(bonusTransactionsTable).values({
        userId: row.user_id,
        promotionId: row.promotion_id,
        type: "expired",
        amount: deduct.toFixed(2),
        balanceBefore: currentBonus.toFixed(2),
        balanceAfter: balAfter.toFixed(2),
        reference: `EXP-${row.reference}`,
        description: `Bonus expired: $${deduct.toFixed(2)} removed`,
      });

      await notify(
        row.user_id,
        "deposit_received",
        "⏰ Bonus Expired",
        `Your $${deduct.toFixed(2)} promotional bonus has expired. Deposit again to earn a new bonus!`
      );

      logger.info({ userId: row.user_id, deduct, reference: row.reference }, "Bonus expired and deducted");
    } catch (err) {
      logger.error({ err, row }, "Failed to expire bonus for user");
    }
  }
}

async function sendExpiryWarnings(): Promise<void> {
  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * HOUR_MS);

  // Find earned bonuses expiring within the next 3 days
  // where we haven't already sent a warning (check notifications table)
  const upcoming = await db.execute(sql`
    SELECT bt.id, bt.user_id, bt.amount, bt.reference, bt.expires_at
    FROM bonus_transactions bt
    WHERE bt.type = 'earned'
      AND bt.expires_at IS NOT NULL
      AND bt.expires_at > ${now}
      AND bt.expires_at <= ${in3Days}
      AND bt.reference IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = bt.user_id
          AND n.type = 'bonus_expiry_warning'
          AND n.message LIKE '%' || bt.reference || '%'
      )
  `);

  const rows = upcoming.rows as Array<{
    id: number;
    user_id: number;
    amount: string;
    reference: string;
    expires_at: string;
  }>;

  if (rows.length === 0) return;

  logger.info({ count: rows.length }, "Sending bonus expiry warnings");

  for (const row of rows) {
    try {
      const expiresAt = new Date(row.expires_at);
      const hoursLeft = Math.round((expiresAt.getTime() - now.getTime()) / HOUR_MS);
      const daysLeft = Math.ceil(hoursLeft / 24);
      const amount = parseFloat(row.amount);

      // Check current balance is still positive
      const [wallet] = await db
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.userId, row.user_id))
        .limit(1);

      const currentBonus = parseFloat((wallet?.bonusBalance as string) || "0");
      if (currentBonus <= 0) continue;

      await notify(
        row.user_id,
        "bonus_expiry_warning" as any,
        "⚠️ Bonus Expiring Soon",
        `Your $${amount.toFixed(2)} bonus (ref: ${row.reference}) expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Use it to watch live streams before it's gone!`
      );

      logger.info({ userId: row.user_id, hoursLeft, reference: row.reference }, "Bonus expiry warning sent");
    } catch (err) {
      logger.error({ err, row }, "Failed to send bonus expiry warning");
    }
  }
}

export function startBonusCron(): void {
  logger.info("Bonus expiry cron started");

  let running = false;

  const tick = () => {
    if (running) {
      logger.warn("Bonus expiry cron: previous run still in progress, skipping");
      return;
    }
    running = true;
    Promise.all([
      expireOldBonuses().catch((err) => logger.error({ err }, "Bonus expiry run failed")),
      sendExpiryWarnings().catch((err) => logger.error({ err }, "Expiry warning run failed")),
    ]).finally(() => { running = false; });
  };

  // Run immediately on startup (catches up on any missed expirations)
  tick();

  // Then run every hour
  setInterval(tick, HOUR_MS);
}
