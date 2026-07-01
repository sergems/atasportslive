import { v4 as uuidv4 } from "uuid";
import { db, gamesTable, betsTable, walletsTable, transactionsTable } from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { notify } from "./notify";
import { logger } from "./logger";

const MINUTE_MS = 60 * 1000;

async function activateStartedGames(): Promise<void> {
  const now = new Date();

  // Find upcoming games whose start time has now passed
  const startedGames = await db.execute(sql`
    SELECT id, player_a, player_b, event_date, event_time
    FROM games
    WHERE status = 'upcoming'
      AND (event_date::text || 'T' || event_time)::timestamp <= ${now}
  `);

  const rows = startedGames.rows as Array<{
    id: number;
    player_a: string;
    player_b: string;
    event_date: string;
    event_time: string;
  }>;

  if (rows.length === 0) return;

  logger.info({ count: rows.length }, "Activating started games and cancelling unmatched bets");

  for (const game of rows) {
    try {
      // 1. Move game from upcoming → live
      await db
        .update(gamesTable)
        .set({ status: "live" })
        .where(and(eq(gamesTable.id, game.id), eq(gamesTable.status, "upcoming")));

      // 2. Find all pending (unmatched) bets for this game
      const pendingBets = await db
        .select()
        .from(betsTable)
        .where(and(eq(betsTable.gameId, game.id), eq(betsTable.status, "pending")));

      if (pendingBets.length === 0) {
        logger.info({ gameId: game.id }, "Game went live — no pending bets to cancel");
        continue;
      }

      // 3. Cancel all pending bets and refund stakes
      const betIds = pendingBets.map((b) => b.id);
      await db
        .update(betsTable)
        .set({ status: "cancelled" })
        .where(inArray(betsTable.id, betIds));

      // Reset open bets count on the game
      await db
        .update(gamesTable)
        .set({ openBetsCount: 0 })
        .where(eq(gamesTable.id, game.id));

      // Refund each user's stake
      for (const bet of pendingBets) {
        const stake = parseFloat(bet.stake as string);

        await db
          .update(walletsTable)
          .set({
            balance: sql`balance + ${stake}`,
            availableBalance: sql`available_balance + ${stake}`,
            pendingBalance: sql`GREATEST(0, pending_balance - ${stake})`,
          })
          .where(eq(walletsTable.userId, bet.userId));

        await db.insert(transactionsTable).values({
          transactionId: `REF-${uuidv4().split("-")[0].toUpperCase()}`,
          userId: bet.userId,
          type: "bet_stake",
          amount: stake.toString(),
          status: "completed",
          paymentMethod: "internal",
          description: `Bet refunded — ${game.player_a} vs ${game.player_b} started before bet was matched (ticket: ${bet.ticketId})`,
        });

        await notify(
          bet.userId,
          "bet_matched",
          "Bet Refunded",
          `Your $${stake.toFixed(2)} bet on ${game.player_a} vs ${game.player_b} was refunded because the event started before it could be matched.`,
        );

        logger.info(
          { gameId: game.id, betId: bet.id, userId: bet.userId, stake },
          "Unmatched bet cancelled and stake refunded",
        );
      }

      logger.info(
        { gameId: game.id, cancelledBets: pendingBets.length },
        "Game activated — all unmatched bets cancelled and refunded",
      );
    } catch (err) {
      logger.error({ err, gameId: game.id }, "Failed to activate game / cancel bets");
    }
  }
}

export function startGameCron(): void {
  logger.info("Game activation cron started (checks every minute)");

  // Run immediately on startup to catch up on any missed transitions
  activateStartedGames().catch((err) =>
    logger.error({ err }, "Game activation startup run failed"),
  );

  // Then run every minute
  setInterval(() => {
    activateStartedGames().catch((err) =>
      logger.error({ err }, "Game activation cron run failed"),
    );
  }, MINUTE_MS);
}
