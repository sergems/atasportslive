import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, betsTable, gamesTable, walletsTable, transactionsTable, usersTable } from "@workspace/db";
import { eq, desc, sql, and, ne } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { notify } from "../lib/notify";
import { sendMail, templates } from "../lib/mailer";

const router = Router();

// Named constant — avoids silent bugs if the system user ID ever changes
const ATA_SYSTEM_USER_ID = parseInt(process.env.ATA_SYSTEM_USER_ID ?? "1", 10);

const toBet = (b: typeof betsTable.$inferSelect, game?: any) => ({
  id: b.id,
  ticketId: b.ticketId,
  userId: b.userId,
  gameId: b.gameId,
  game: game || null,
  outcome: b.outcome,
  stake: parseFloat(b.stake as string),
  potentialReturn: parseFloat(b.potentialReturn as string),
  status: b.status,
  matchedBetId: b.matchedBetId,
  createdAt: b.createdAt,
  settledAt: b.settledAt,
});

const BROKERAGE_FEE = 0.10;

router.post("/", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { gameId, outcome, stake } = req.body;
  const userId = req.userId!;

  if (!gameId || !outcome || !stake || stake <= 0) {
    res.status(400).json({ error: "gameId, outcome, stake required" });
    return;
  }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId)).limit(1);
  if (!game || game.status !== "upcoming") {
    res.status(400).json({ error: "Betting is only available for upcoming events" });
    return;
  }

  // Block betting once the event start time has passed
  const eventStart = new Date(`${game.eventDate}T${game.eventTime || "00:00"}:00`);
  if (new Date() >= eventStart) {
    res.status(400).json({ error: "Betting is closed — this event has already started" });
    return;
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
  if (!wallet || parseFloat(wallet.availableBalance as string) < stake) {
    res.status(400).json({ error: "Insufficient wallet balance" });
    return;
  }

  const oppositeOutcome = outcome === "player_a_wins" ? "player_b_wins" : "player_a_wins";
  const ticketId = `TKT-${uuidv4().split("-")[0].toUpperCase()}`;

  // Read candidates outside the transaction (non-blocking reads)
  const exactMatches = await db
    .select()
    .from(betsTable)
    .where(
      and(
        eq(betsTable.gameId, gameId),
        eq(betsTable.outcome, oppositeOutcome),
        eq(betsTable.status, "pending"),
        ne(betsTable.userId, userId),
        sql`${betsTable.stake} = ${stake}`
      )
    )
    .limit(1);

  const nearMatchCandidates = exactMatches.length === 0
    ? await db.select().from(betsTable).where(
        and(
          eq(betsTable.gameId, gameId),
          eq(betsTable.outcome, oppositeOutcome),
          eq(betsTable.status, "pending"),
          ne(betsTable.userId, userId)
        )
      ).limit(10)
    : [];

  const nearMatches = nearMatchCandidates
    .map((b) => ({ betId: b.id, stake: parseFloat(b.stake as string), difference: Math.abs(parseFloat(b.stake as string) - stake) }))
    .filter((b) => b.difference / stake <= 0.2)
    .sort((a, b) => a.difference - b.difference)
    .slice(0, 3);

  // --- All financial writes wrapped in a single atomic transaction ---
  let newBet: typeof betsTable.$inferSelect;
  let matchStatus: string;
  let opponentId: number | null = null;

  if (exactMatches.length > 0) {
    const opponent = exactMatches[0];
    const pool = stake * 2;
    const fee = pool * BROKERAGE_FEE;
    const winnerPayout = pool - fee;

    newBet = await db.transaction(async (tx) => {
      // 1. Lock stake from bettor's wallet
      await tx.update(walletsTable).set({
        balance: sql`balance - ${stake}`,
        availableBalance: sql`available_balance - ${stake}`,
        pendingBalance: sql`pending_balance + ${stake}`,
      }).where(eq(walletsTable.userId, userId));

      await tx.insert(transactionsTable).values({
        transactionId: `BET-${uuidv4().split("-")[0].toUpperCase()}`,
        userId,
        type: "bet_stake",
        amount: stake.toString(),
        status: "completed",
        paymentMethod: "internal",
        description: `Bet stake on game #${gameId}`,
      });

      // 2. Insert the new bet (matched immediately)
      const [inserted] = await tx.insert(betsTable).values({
        ticketId,
        userId,
        gameId,
        outcome,
        stake: stake.toString(),
        potentialReturn: winnerPayout.toString(),
        status: "matched",
        matchedBetId: opponent.id,
      }).returning();

      // 3. Update opponent bet
      await tx.update(betsTable).set({
        status: "matched",
        matchedBetId: inserted.id,
        potentialReturn: winnerPayout.toString(),
      }).where(eq(betsTable.id, opponent.id));

      // 4. Update game pool
      await tx.update(gamesTable).set({
        matchedBetsCount: sql`matched_bets_count + 1`,
        totalBetPool: sql`total_bet_pool + ${pool}`,
      }).where(eq(gamesTable.id, gameId));

      // 5. ATA brokerage fee record
      await tx.insert(transactionsTable).values({
        transactionId: `FEE-${uuidv4().split("-")[0].toUpperCase()}`,
        userId: ATA_SYSTEM_USER_ID,
        type: "brokerage_fee",
        amount: fee.toString(),
        status: "completed",
        paymentMethod: "internal",
        description: `10% brokerage fee for game #${gameId}`,
      });

      return inserted;
    });

    matchStatus = "exact_match";
    opponentId = exactMatches[0].userId;

    // Side-effects outside the transaction (non-critical — failures don't corrupt data)
    await notify(userId, "bet_matched", "Bet Matched!", `Your bet of ${stake} has been matched!`);
    await notify(opponentId!, "bet_matched", "Bet Matched!", `Your bet of ${stake} has been matched!`);

    const [betUser, oppUser] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1).then((r) => r[0]),
      db.select().from(usersTable).where(eq(usersTable.id, opponentId)).limit(1).then((r) => r[0]),
    ]);
    const gameName = `${game.playerA} vs ${game.playerB}`;
    for (const [u, betOutcome] of [[betUser, outcome], [oppUser, oppositeOutcome]] as [typeof betUser, string][]) {
      if (u?.email) {
        sendMail({
          to: u.email,
          subject: "Bet Matched – ATA Sports Live",
          html: templates.betMatched({ name: u.fullName ?? u.email, stake, outcome: betOutcome, potentialReturn: (stake * 2) * (1 - BROKERAGE_FEE), gameName }),
        }).catch(() => {});
      }
    }

    res.status(201).json({ bet: toBet(newBet), matchStatus: "exact_match", nearMatches: [] });
    return;
  }

  // No exact match — place pending bet atomically
  newBet = await db.transaction(async (tx) => {
    await tx.update(walletsTable).set({
      balance: sql`balance - ${stake}`,
      availableBalance: sql`available_balance - ${stake}`,
      pendingBalance: sql`pending_balance + ${stake}`,
    }).where(eq(walletsTable.userId, userId));

    await tx.insert(transactionsTable).values({
      transactionId: `BET-${uuidv4().split("-")[0].toUpperCase()}`,
      userId,
      type: "bet_stake",
      amount: stake.toString(),
      status: "completed",
      paymentMethod: "internal",
      description: `Bet stake on game #${gameId}`,
    });

    const [inserted] = await tx.insert(betsTable).values({
      ticketId,
      userId,
      gameId,
      outcome,
      stake: stake.toString(),
      potentialReturn: "0",
      status: "pending",
    }).returning();

    await tx.update(gamesTable).set({
      openBetsCount: sql`open_bets_count + 1`,
    }).where(eq(gamesTable.id, gameId));

    return inserted;
  });

  matchStatus = nearMatches.length > 0 ? "near_match" : "unmatched";
  if (nearMatches.length > 0) {
    await notify(userId, "near_match", "Near Match Found", `A near match was found for your ${stake} bet!`);
  }

  res.status(201).json({ bet: toBet(newBet), matchStatus, nearMatches });
});

router.get("/my", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const status = req.query.status as string | undefined;
  const offset = (page - 1) * limit;

  const baseWhere = eq(betsTable.userId, req.userId!);
  const countWhere = status ? and(baseWhere, eq(betsTable.status, status as any)) : baseWhere;
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(betsTable).where(countWhere);
  let q = db.select().from(betsTable).where(eq(betsTable.userId, req.userId!)).$dynamic();
  if (status) q = q.where(eq(betsTable.status, status as any));

  const bets = await q.orderBy(desc(betsTable.createdAt)).limit(limit).offset(offset);
  const gameIds = [...new Set(bets.map((b) => b.gameId))];
  const games = gameIds.length > 0 ? await db.select().from(gamesTable).where(sql`id = ANY(ARRAY[${sql.join(gameIds.map((id) => sql`${id}`), sql`, `)}]::int[])`) : [];
  const gameMap = new Map(games.map((g) => [g.id, g]));

  res.json({ bets: bets.map((b) => toBet(b, gameMap.get(b.gameId) ? { id: gameMap.get(b.gameId)!.id, sport: gameMap.get(b.gameId)!.sport, playerA: gameMap.get(b.gameId)!.playerA, playerB: gameMap.get(b.gameId)!.playerB, status: gameMap.get(b.gameId)!.status } : null)), total: Number(count), page, limit });
});

router.get("/all", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const status = req.query.status as string | undefined;
  const offset = (page - 1) * limit;

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(betsTable);
  let q = db.select().from(betsTable).$dynamic();
  if (status) q = q.where(eq(betsTable.status, status as any));

  const bets = await q.orderBy(desc(betsTable.createdAt)).limit(limit).offset(offset);
  res.json({ bets: bets.map((b) => toBet(b)), total: Number(count), page, limit });
});

router.get("/:id", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const [bet] = await db.select().from(betsTable).where(eq(betsTable.id, Number(req.params.id))).limit(1);
  if (!bet) {
    res.status(404).json({ error: "Bet not found" });
    return;
  }
  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, bet.gameId)).limit(1);

  const oppositeOutcome = bet.outcome === "player_a_wins" ? "player_b_wins" : "player_a_wins";
  const nearMatchCandidates = await db
    .select()
    .from(betsTable)
    .where(
      and(eq(betsTable.gameId, bet.gameId), eq(betsTable.outcome, oppositeOutcome), eq(betsTable.status, "pending"), ne(betsTable.userId, bet.userId))
    )
    .limit(5);

  const nearMatches = nearMatchCandidates
    .map((b) => ({ betId: b.id, stake: parseFloat(b.stake as string), difference: Math.abs(parseFloat(b.stake as string) - parseFloat(bet.stake as string)) }))
    .filter((b) => b.difference / parseFloat(bet.stake as string) <= 0.2)
    .sort((a, b) => a.difference - b.difference);

  res.json({ bet: toBet(bet, game ? { id: game.id, sport: game.sport, playerA: game.playerA, playerB: game.playerB, status: game.status } : null), matchStatus: bet.status === "matched" ? "exact_match" : nearMatches.length > 0 ? "near_match" : "unmatched", nearMatches });
});

// Admin-only: cancel any pending bet and refund the user
router.post("/:id/cancel", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const [bet] = await db.select().from(betsTable).where(eq(betsTable.id, id)).limit(1);
  if (!bet || bet.status !== "pending") {
    res.status(400).json({ error: "Can only cancel pending bets" });
    return;
  }
  await db.update(betsTable).set({ status: "cancelled" }).where(eq(betsTable.id, id));
  const stake = parseFloat(bet.stake as string);
  await db.update(walletsTable).set({
    balance: sql`balance + ${stake}`,
    availableBalance: sql`available_balance + ${stake}`,
    pendingBalance: sql`pending_balance - ${stake}`,
  }).where(eq(walletsTable.userId, bet.userId));
  await db.update(gamesTable).set({ openBetsCount: sql`open_bets_count - 1` }).where(eq(gamesTable.id, bet.gameId));
  await db.insert(transactionsTable).values({
    transactionId: `CAN-${uuidv4().split("-")[0].toUpperCase()}`,
    userId: bet.userId,
    type: "bet_stake",
    amount: stake.toString(),
    status: "completed",
    paymentMethod: "internal",
    description: `Bet cancelled by admin (bet #${id}) — stake refunded`,
  });
  const [updated] = await db.select().from(betsTable).where(eq(betsTable.id, id)).limit(1);
  res.json(toBet(updated));
});

router.post("/:id/accept-near-match", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const { opponentBetId } = req.body;
  const userId = req.userId!;

  const [myBet] = await db.select().from(betsTable).where(and(eq(betsTable.id, id), eq(betsTable.userId, userId))).limit(1);
  if (!myBet || myBet.status !== "pending") {
    res.status(400).json({ error: "Bet not available" });
    return;
  }

  const [opponentBet] = await db.select().from(betsTable).where(and(eq(betsTable.id, opponentBetId), eq(betsTable.status, "pending"))).limit(1);
  if (!opponentBet) {
    res.status(404).json({ error: "Opponent bet not found or already matched" });
    return;
  }

  const myStake = parseFloat(myBet.stake as string);
  const opStake = parseFloat(opponentBet.stake as string);
  // Always match at the opponent's exact stake amount
  const matchStake = opStake;
  const pool = matchStake * 2;
  const fee = pool * BROKERAGE_FEE;
  const winnerPayout = pool - fee;

  // Pre-check top-up balance BEFORE entering the transaction (read-only, safe outside)
  if (myStake < matchStake) {
    const topUp = matchStake - myStake;
    const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
    if (!wallet || parseFloat(wallet.availableBalance as string) < topUp) {
      res.status(400).json({ error: `Insufficient balance — you need ${topUp.toFixed(2)} more to accept this match` });
      return;
    }
  }

  // Wrap all financial writes in a single atomic transaction.
  // A failure at any point rolls back the entire operation — no half-settled bets.
  await db.transaction(async (tx) => {
    if (myStake > matchStake) {
      // I staked more — refund the difference back to my wallet
      const refund = myStake - matchStake;
      await tx.update(walletsTable).set({
        balance: sql`balance + ${refund}`,
        availableBalance: sql`available_balance + ${refund}`,
        pendingBalance: sql`pending_balance - ${refund}`,
      }).where(eq(walletsTable.userId, userId));
      await tx.insert(transactionsTable).values({
        transactionId: `REF-${uuidv4().split("-")[0].toUpperCase()}`,
        userId,
        type: "bet_stake",
        amount: refund.toString(),
        status: "completed",
        paymentMethod: "internal",
        description: `Stake refund — near-match settled at ${matchStake.toFixed(2)} (original ${myStake.toFixed(2)})`,
      });
    } else if (myStake < matchStake) {
      // I staked less — top-up required; deduct the difference from my wallet
      const topUp = matchStake - myStake;
      await tx.update(walletsTable).set({
        balance: sql`balance - ${topUp}`,
        availableBalance: sql`available_balance - ${topUp}`,
        pendingBalance: sql`pending_balance + ${topUp}`,
      }).where(eq(walletsTable.userId, userId));
      await tx.insert(transactionsTable).values({
        transactionId: `TOP-${uuidv4().split("-")[0].toUpperCase()}`,
        userId,
        type: "bet_stake",
        amount: topUp.toString(),
        status: "completed",
        paymentMethod: "internal",
        description: `Stake top-up — near-match settled at ${matchStake.toFixed(2)} (original ${myStake.toFixed(2)})`,
      });
    }

    // Update both bets to matched at the reconciled stake
    await tx.update(betsTable).set({
      status: "matched",
      matchedBetId: opponentBet.id,
      stake: matchStake.toString(),
      potentialReturn: winnerPayout.toString(),
    }).where(eq(betsTable.id, id));

    await tx.update(betsTable).set({
      status: "matched",
      matchedBetId: id,
      potentialReturn: winnerPayout.toString(),
    }).where(eq(betsTable.id, opponentBetId));

    // Brokerage fee record
    await tx.insert(transactionsTable).values({
      transactionId: `FEE-${uuidv4().split("-")[0].toUpperCase()}`,
      userId: ATA_SYSTEM_USER_ID,
      type: "brokerage_fee",
      amount: fee.toString(),
      status: "completed",
      paymentMethod: "internal",
      description: `10% brokerage fee for near-match on game #${myBet.gameId}`,
    });

    await tx.update(gamesTable).set({
      matchedBetsCount: sql`matched_bets_count + 1`,
      openBetsCount: sql`open_bets_count - 2`,
      totalBetPool: sql`total_bet_pool + ${pool}`,
    }).where(eq(gamesTable.id, myBet.gameId));
  });

  // Side-effects outside the transaction (non-critical)
  await notify(opponentBet.userId, "bet_matched", "Bet Matched!", `Your bet has been matched for ${matchStake.toFixed(2)}!`);
  await notify(userId, "bet_matched", "Bet Matched!", `Your bet has been matched for ${matchStake.toFixed(2)}!`);

  const [updated] = await db.select().from(betsTable).where(eq(betsTable.id, id)).limit(1);
  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, myBet.gameId)).limit(1);
  res.json({ bet: toBet(updated, game ? { id: game.id, sport: game.sport, playerA: game.playerA, playerB: game.playerB, status: game.status } : null), matchStatus: "exact_match", nearMatches: [] });
});

export default router;
