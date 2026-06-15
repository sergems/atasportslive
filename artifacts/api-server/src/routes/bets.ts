import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, betsTable, gamesTable, walletsTable, transactionsTable } from "@workspace/db";
import { eq, desc, sql, and, ne } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { notify } from "../lib/notify";

const router = Router();

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
  if (!game || !["upcoming", "live"].includes(game.status)) {
    res.status(400).json({ error: "Game not available for betting" });
    return;
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
  if (!wallet || parseFloat(wallet.availableBalance as string) < stake) {
    res.status(400).json({ error: "Insufficient wallet balance" });
    return;
  }

  const oppositeOutcome = outcome === "player_a_wins" ? "player_b_wins" : "player_a_wins";

  // Lock stake
  await db.update(walletsTable).set({
    availableBalance: sql`available_balance - ${stake}`,
    pendingBalance: sql`pending_balance + ${stake}`,
  }).where(eq(walletsTable.userId, userId));

  await db.insert(transactionsTable).values({
    transactionId: `BET-${uuidv4().split("-")[0].toUpperCase()}`,
    userId,
    type: "bet_stake",
    amount: stake.toString(),
    status: "completed",
    paymentMethod: "internal",
    description: `Bet stake on game #${gameId}`,
  });

  // Try exact match
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

  let ticketId = `TKT-${uuidv4().split("-")[0].toUpperCase()}`;

  if (exactMatches.length > 0) {
    const opponent = exactMatches[0];
    const pool = stake * 2;
    const fee = pool * BROKERAGE_FEE;
    const winnerPayout = pool - fee;

    const [newBet] = await db.insert(betsTable).values({
      ticketId,
      userId,
      gameId,
      outcome,
      stake: stake.toString(),
      potentialReturn: winnerPayout.toString(),
      status: "matched",
      matchedBetId: opponent.id,
    }).returning();

    await db.update(betsTable).set({
      status: "matched",
      matchedBetId: newBet.id,
      potentialReturn: winnerPayout.toString(),
    }).where(eq(betsTable.id, opponent.id));

    await db.update(gamesTable).set({
      matchedBetsCount: sql`matched_bets_count + 1`,
      totalBetPool: sql`total_bet_pool + ${pool}`,
    }).where(eq(gamesTable.id, gameId));

    // ATA fee
    await db.insert(transactionsTable).values({
      transactionId: `FEE-${uuidv4().split("-")[0].toUpperCase()}`,
      userId: 1, // ATA system account
      type: "brokerage_fee",
      amount: fee.toString(),
      status: "completed",
      paymentMethod: "internal",
      description: `10% brokerage fee for game #${gameId}`,
    });

    await notify(userId, "bet_matched", "Bet Matched!", `Your bet of $${stake} has been matched!`);
    await notify(opponent.userId, "bet_matched", "Bet Matched!", `Your bet of $${stake} has been matched!`);

    res.status(201).json({ bet: toBet(newBet), matchStatus: "exact_match", nearMatches: [] });
    return;
  }

  // Find near matches (within 20%)
  const nearMatchCandidates = await db
    .select()
    .from(betsTable)
    .where(
      and(
        eq(betsTable.gameId, gameId),
        eq(betsTable.outcome, oppositeOutcome),
        eq(betsTable.status, "pending"),
        ne(betsTable.userId, userId)
      )
    )
    .limit(10);

  const nearMatches = nearMatchCandidates
    .map((b) => ({ betId: b.id, stake: parseFloat(b.stake as string), difference: Math.abs(parseFloat(b.stake as string) - stake) }))
    .filter((b) => b.difference / stake <= 0.2)
    .sort((a, b) => a.difference - b.difference)
    .slice(0, 3);

  const [newBet] = await db.insert(betsTable).values({
    ticketId,
    userId,
    gameId,
    outcome,
    stake: stake.toString(),
    potentialReturn: "0",
    status: "pending",
  }).returning();

  await db.update(gamesTable).set({
    openBetsCount: sql`open_bets_count + 1`,
  }).where(eq(gamesTable.id, gameId));

  const matchStatus = nearMatches.length > 0 ? "near_match" : "unmatched";
  if (nearMatches.length > 0) {
    await notify(userId, "near_match", "Near Match Found", `A near match was found for your $${stake} bet!`);
  }

  res.status(201).json({ bet: toBet(newBet), matchStatus, nearMatches });
});

router.get("/my", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const status = req.query.status as string | undefined;
  const offset = (page - 1) * limit;

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(betsTable).where(eq(betsTable.userId, req.userId!));
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

router.post("/:id/cancel", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const [bet] = await db.select().from(betsTable).where(and(eq(betsTable.id, id), eq(betsTable.userId, req.userId!))).limit(1);
  if (!bet || bet.status !== "pending") {
    res.status(400).json({ error: "Can only cancel pending bets" });
    return;
  }
  await db.update(betsTable).set({ status: "cancelled" }).where(eq(betsTable.id, id));
  const stake = parseFloat(bet.stake as string);
  await db.update(walletsTable).set({
    availableBalance: sql`available_balance + ${stake}`,
    withdrawableBalance: sql`withdrawable_balance + ${stake}`,
    pendingBalance: sql`pending_balance - ${stake}`,
  }).where(eq(walletsTable.userId, req.userId!));
  await db.update(gamesTable).set({ openBetsCount: sql`open_bets_count - 1` }).where(eq(gamesTable.id, bet.gameId));
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
    res.status(404).json({ error: "Opponent bet not found" });
    return;
  }

  const myStake = parseFloat(myBet.stake as string);
  const opStake = parseFloat(opponentBet.stake as string);
  const minStake = Math.min(myStake, opStake);
  const pool = minStake * 2;
  const fee = pool * BROKERAGE_FEE;
  const winnerPayout = pool - fee;

  await db.update(betsTable).set({ status: "matched", matchedBetId: opponentBet.id, potentialReturn: winnerPayout.toString() }).where(eq(betsTable.id, id));
  await db.update(betsTable).set({ status: "matched", matchedBetId: id, potentialReturn: winnerPayout.toString() }).where(eq(betsTable.id, opponentBetId));

  await db.update(gamesTable).set({
    matchedBetsCount: sql`matched_bets_count + 1`,
    openBetsCount: sql`open_bets_count - 2`,
    totalBetPool: sql`total_bet_pool + ${pool}`,
  }).where(eq(gamesTable.id, myBet.gameId));

  await notify(opponentBet.userId, "bet_matched", "Bet Matched!", `Your bet has been matched for $${minStake}!`);
  await notify(userId, "bet_matched", "Bet Matched!", `Your bet has been matched for $${minStake}!`);

  const [updated] = await db.select().from(betsTable).where(eq(betsTable.id, id)).limit(1);
  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, myBet.gameId)).limit(1);
  res.json({ bet: toBet(updated, game ? { id: game.id, sport: game.sport, playerA: game.playerA, playerB: game.playerB, status: game.status } : null), matchStatus: "exact_match", nearMatches: [] });
});

export default router;
