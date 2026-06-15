import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, gamesTable, betsTable, walletsTable, transactionsTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { notify } from "../lib/notify";

const router = Router();

const toGame = (g: typeof gamesTable.$inferSelect) => ({
  id: g.id,
  sport: g.sport,
  playerA: g.playerA,
  playerB: g.playerB,
  eventDate: g.eventDate,
  eventTime: g.eventTime,
  status: g.status,
  result: g.result,
  totalBetPool: parseFloat(g.totalBetPool as string),
  openBetsCount: g.openBetsCount,
  matchedBetsCount: g.matchedBetsCount,
  createdAt: g.createdAt,
});

router.get("/", async (req, res): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const status = req.query.status as string | undefined;
  const sport = req.query.sport as string | undefined;
  const offset = (page - 1) * limit;

  let q = db.select().from(gamesTable).$dynamic();
  if (status) q = q.where(eq(gamesTable.status, status as any));
  if (sport) q = q.where(eq(gamesTable.sport, sport as any));

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(gamesTable);
  const games = await q.orderBy(desc(gamesTable.createdAt)).limit(limit).offset(offset);
  res.json({ games: games.map(toGame), total: Number(count), page, limit });
});

router.get("/upcoming", async (req, res): Promise<void> => {
  const games = await db
    .select()
    .from(gamesTable)
    .where(eq(gamesTable.status, "upcoming"))
    .orderBy(gamesTable.eventDate)
    .limit(10);
  res.json(games.map(toGame));
});

router.post("/", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const { sport, playerA, playerB, eventDate, eventTime } = req.body;
  if (!sport || !playerA || !playerB || !eventDate || !eventTime) {
    res.status(400).json({ error: "All fields required" });
    return;
  }
  const [game] = await db.insert(gamesTable).values({ sport, playerA, playerB, eventDate, eventTime }).returning();
  res.status(201).json(toGame(game));
});

router.get("/:id", async (req, res): Promise<void> => {
  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, Number(req.params.id))).limit(1);
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  res.json(toGame(game));
});

router.patch("/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const { sport, playerA, playerB, eventDate, eventTime, status } = req.body;
  const updates: Record<string, any> = {};
  if (sport) updates.sport = sport;
  if (playerA) updates.playerA = playerA;
  if (playerB) updates.playerB = playerB;
  if (eventDate) updates.eventDate = eventDate;
  if (eventTime) updates.eventTime = eventTime;
  if (status) updates.status = status;
  const [game] = await db.update(gamesTable).set(updates).where(eq(gamesTable.id, id)).returning();
  res.json(toGame(game));
});

router.post("/:id/settle", authMiddleware, requireRole("admin", "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const { result } = req.body;
  if (!["player_a_wins", "player_b_wins", "draw"].includes(result)) {
    res.status(400).json({ error: "Invalid result" });
    return;
  }

  const [game] = await db.update(gamesTable).set({ status: "completed", result }).where(eq(gamesTable.id, id)).returning();

  // Settle matched bets
  const matchedBets = await db.select().from(betsTable).where(and(eq(betsTable.gameId, id), eq(betsTable.status, "matched")));

  for (const bet of matchedBets) {
    const isWinner = bet.outcome === result;
    const newStatus = result === "draw" ? "refunded" : isWinner ? "won" : "lost";

    await db.update(betsTable).set({ status: newStatus, settledAt: new Date() }).where(eq(betsTable.id, bet.id));

    if (newStatus === "won") {
      const payout = parseFloat(bet.potentialReturn as string);
      await db.update(walletsTable).set({
        balance: sql`balance + ${payout}`,
        availableBalance: sql`available_balance + ${payout}`,
        withdrawableBalance: sql`withdrawable_balance + ${payout}`,
      }).where(eq(walletsTable.userId, bet.userId));
      await db.insert(transactionsTable).values({
        transactionId: `WIN-${uuidv4().split("-")[0].toUpperCase()}`,
        userId: bet.userId,
        type: "bet_win",
        amount: payout.toString(),
        status: "completed",
        paymentMethod: "internal",
        description: `Bet win payout for game #${id}`,
      });
      await notify(bet.userId, "bet_won", "You Won!", `Congratulations! You won $${payout.toFixed(2)} on your bet.`);
    } else if (newStatus === "refunded") {
      const refund = parseFloat(bet.stake as string);
      await db.update(walletsTable).set({
        balance: sql`balance + ${refund}`,
        availableBalance: sql`available_balance + ${refund}`,
        withdrawableBalance: sql`withdrawable_balance + ${refund}`,
      }).where(eq(walletsTable.userId, bet.userId));
      await db.insert(transactionsTable).values({
        transactionId: `REF-${uuidv4().split("-")[0].toUpperCase()}`,
        userId: bet.userId,
        type: "bet_refund",
        amount: refund.toString(),
        status: "completed",
        paymentMethod: "internal",
        description: `Bet refund (draw) for game #${id}`,
      });
      await notify(bet.userId, "bet_refunded", "Bet Refunded", `Your bet was refunded due to a draw.`);
    } else {
      await notify(bet.userId, "bet_lost", "Bet Lost", `Your bet on game #${id} did not win.`);
    }
    await notify(bet.userId, "match_result", "Match Result", `Game #${id} result: ${result.replace(/_/g, " ")}`);
  }

  res.json(toGame(game));
});

router.post("/:id/cancel", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const [game] = await db.update(gamesTable).set({ status: "cancelled" }).where(eq(gamesTable.id, id)).returning();

  const allBets = await db.select().from(betsTable).where(and(eq(betsTable.gameId, id)));
  for (const bet of allBets) {
    if (["pending", "matched", "live"].includes(bet.status)) {
      await db.update(betsTable).set({ status: "refunded", settledAt: new Date() }).where(eq(betsTable.id, bet.id));
      const refund = parseFloat(bet.stake as string);
      await db.update(walletsTable).set({
        balance: sql`balance + ${refund}`,
        availableBalance: sql`available_balance + ${refund}`,
        withdrawableBalance: sql`withdrawable_balance + ${refund}`,
      }).where(eq(walletsTable.userId, bet.userId));
      await db.insert(transactionsTable).values({
        transactionId: `REF-${uuidv4().split("-")[0].toUpperCase()}`,
        userId: bet.userId,
        type: "bet_refund",
        amount: refund.toString(),
        status: "completed",
        paymentMethod: "internal",
        description: `Game cancelled: refund for game #${id}`,
      });
      await notify(bet.userId, "bet_refunded", "Game Cancelled", `Game #${id} was cancelled. Your stake has been refunded.`);
    }
  }
  res.json(toGame(game));
});

router.get("/:id/bets", async (req, res): Promise<void> => {
  const bets = await db.select().from(betsTable).where(eq(betsTable.gameId, Number(req.params.id)));
  const games = await db.select().from(gamesTable).where(eq(gamesTable.id, Number(req.params.id))).limit(1);
  const game = games[0];
  res.json(bets.map((b) => ({
    id: b.id,
    ticketId: b.ticketId,
    userId: b.userId,
    gameId: b.gameId,
    game: game ? toGame(game) : null,
    outcome: b.outcome,
    stake: parseFloat(b.stake as string),
    potentialReturn: parseFloat(b.potentialReturn as string),
    status: b.status,
    matchedBetId: b.matchedBetId,
    createdAt: b.createdAt,
    settledAt: b.settledAt,
  })));
});

export default router;
