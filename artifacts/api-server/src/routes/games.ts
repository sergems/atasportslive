import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, gamesTable, streamsTable, betsTable, walletsTable, transactionsTable, usersTable } from "@workspace/db";
import { eq, desc, asc, sql, and, gte } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { notify } from "../lib/notify";
import { sendMail, templates } from "../lib/mailer";

const router = Router();

const toGame = (g: typeof gamesTable.$inferSelect) => ({
  id: g.id,
  type: g.type,
  parentId: g.parentId,
  sport: g.sport,
  playerA: g.playerA,
  playerB: g.playerB,
  playerACountry: g.playerACountry,
  playerBCountry: g.playerBCountry,
  eventDate: g.eventDate,
  eventTime: g.eventTime,
  eventEndDate: g.eventEndDate,
  eventEndTime: g.eventEndTime,
  city: g.city,
  country: g.country,
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
  const filters = [];
  if (status) filters.push(eq(gamesTable.status, status as any));
  if (sport) filters.push(eq(gamesTable.sport, sport as any));
  if (filters.length > 0) q = q.where(and(...filters));

  const countQ = db.select({ count: sql<number>`count(*)` }).from(gamesTable);
  const [{ count }] = filters.length > 0 ? await countQ.where(and(...filters)) : await countQ;
  const games = await q.orderBy(asc(gamesTable.eventDate), asc(gamesTable.eventTime)).limit(limit).offset(offset);
  res.json({ games: games.map(toGame), total: Number(count), page, limit });
});

router.get("/upcoming", async (req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const games = await db
    .select()
    .from(gamesTable)
    .where(and(eq(gamesTable.status, "upcoming"), gte(gamesTable.eventDate, today)))
    .orderBy(gamesTable.eventDate)
    .limit(10);
  res.json(games.map(toGame));
});

router.post("/", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const { type = "single", parentId, sport, playerA, playerB, playerACountry, playerBCountry, eventDate, eventTime, eventEndDate, eventEndTime, city, country } = req.body;
  if (!sport || !playerA || !eventDate || !eventTime) {
    res.status(400).json({ error: "sport, playerA (name/team), eventDate, eventTime required" });
    return;
  }
  if (type === "single" && !playerB && !parentId) {
    res.status(400).json({ error: "playerB required for single matches" });
    return;
  }
  const [game] = await db.insert(gamesTable).values({
    type,
    parentId: parentId ? Number(parentId) : null,
    sport,
    playerA,
    playerB: playerB || "",
    playerACountry: playerACountry || null,
    playerBCountry: playerBCountry || null,
    eventDate,
    eventTime,
    eventEndDate: eventEndDate || null,
    eventEndTime: eventEndTime || null,
    city: city || null,
    country: country || null,
  }).returning();

  // Auto-create a stream when a match is added to a competition
  if (parentId) {
    const [parent] = await db.select().from(gamesTable).where(eq(gamesTable.id, Number(parentId))).limit(1);
    if (parent && parent.type === "competition") {
      const streamTitle = `${parent.playerA} — ${playerA} vs ${playerB || "TBD"}`;
      const startTime = new Date(`${eventDate}T${eventTime}:00`);
      const endTime = (eventEndDate && eventEndTime)
        ? new Date(`${eventEndDate}T${eventEndTime}:00`)
        : eventEndDate ? new Date(`${eventEndDate}T23:59:00`) : null;
      await db.insert(streamsTable).values({
        title: streamTitle,
        sport: sport || parent.sport,
        startTime,
        endTime,
        city: city || parent.city || null,
        country: country || parent.country || null,
        accessPrice: "1.50",
      });
    }
  }

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
  const { type, parentId, sport, playerA, playerB, playerACountry, playerBCountry, eventDate, eventTime, eventEndDate, eventEndTime, city, country, status } = req.body;
  const updates: Record<string, any> = {};
  if (type !== undefined) updates.type = type;
  if (parentId !== undefined) updates.parentId = parentId ? Number(parentId) : null;
  if (sport !== undefined) updates.sport = sport;
  if (playerA !== undefined) updates.playerA = playerA;
  if (playerB !== undefined) updates.playerB = playerB;
  if (playerACountry !== undefined) updates.playerACountry = playerACountry || null;
  if (playerBCountry !== undefined) updates.playerBCountry = playerBCountry || null;
  if (eventDate !== undefined) updates.eventDate = eventDate;
  if (eventTime !== undefined) updates.eventTime = eventTime;
  if (eventEndDate !== undefined) updates.eventEndDate = eventEndDate || null;
  if (eventEndTime !== undefined) updates.eventEndTime = eventEndTime || null;
  if (city !== undefined) updates.city = city || null;
  if (country !== undefined) updates.country = country || null;
  if (status !== undefined) updates.status = status;
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

  const gameName = `${game.playerA} vs ${game.playerB}`;

  // 1. Settle all matched bets
  const matchedBets = await db.select().from(betsTable).where(and(eq(betsTable.gameId, id), eq(betsTable.status, "matched")));

  for (const bet of matchedBets) {
    const isWinner = bet.outcome === result;
    const newStatus = result === "draw" ? "refunded" : isWinner ? "won" : "lost";

    await db.update(betsTable).set({ status: newStatus, settledAt: new Date() }).where(eq(betsTable.id, bet.id));

    if (newStatus === "won") {
      const payout = parseFloat(bet.potentialReturn as string);
      const betStake = parseFloat(bet.stake as string);
      // Credit winnings and move stake out of pending
      await db.update(walletsTable).set({
        balance: sql`balance + ${payout}`,
        availableBalance: sql`available_balance + ${payout}`,
        withdrawableBalance: sql`withdrawable_balance + ${payout}`,
        pendingBalance: sql`GREATEST(0, pending_balance - ${betStake})`,
      }).where(eq(walletsTable.userId, bet.userId));
      await db.insert(transactionsTable).values({
        transactionId: `WIN-${uuidv4().split("-")[0].toUpperCase()}`,
        userId: bet.userId,
        type: "bet_win",
        amount: payout.toString(),
        status: "completed",
        paymentMethod: "internal",
        description: `Bet win — ${gameName} · ticket ${bet.ticketId}`,
      });
      await notify(bet.userId, "bet_won", "You Won!", `Congratulations! You won $${payout.toFixed(2)} on your bet.`);
      const [winUser] = await db.select().from(usersTable).where(eq(usersTable.id, bet.userId)).limit(1);
      if (winUser?.email) {
        sendMail({
          to: winUser.email,
          subject: `You Won $${payout.toFixed(2)}! – ATA Sports Live`,
          html: templates.betWon({
            name: winUser.fullName ?? winUser.email,
            stake: parseFloat(bet.stake as string),
            payout,
            gameName,
          }),
        }).catch(() => {});
      }
    } else if (newStatus === "refunded") {
      const refund = parseFloat(bet.stake as string);
      await db.update(walletsTable).set({
        balance: sql`balance + ${refund}`,
        availableBalance: sql`available_balance + ${refund}`,
        pendingBalance: sql`GREATEST(0, pending_balance - ${refund})`,
      }).where(eq(walletsTable.userId, bet.userId));
      await db.insert(transactionsTable).values({
        transactionId: `REF-${uuidv4().split("-")[0].toUpperCase()}`,
        userId: bet.userId,
        type: "bet_refund",
        amount: refund.toString(),
        status: "completed",
        paymentMethod: "internal",
        description: `Bet refund (draw) — ${gameName} · ticket ${bet.ticketId}`,
      });
      await notify(bet.userId, "bet_refunded", "Bet Refunded", `Your bet was refunded due to a draw.`);
    } else {
      // Lost — move stake out of pending (money already deducted at bet time)
      const lostStake = parseFloat(bet.stake as string);
      await db.update(walletsTable).set({
        pendingBalance: sql`GREATEST(0, pending_balance - ${lostStake})`,
      }).where(eq(walletsTable.userId, bet.userId));
      // Create a record so the transaction history is complete
      await db.insert(transactionsTable).values({
        transactionId: `LST-${uuidv4().split("-")[0].toUpperCase()}`,
        userId: bet.userId,
        type: "bet_stake",
        amount: lostStake.toString(),
        status: "completed",
        paymentMethod: "internal",
        description: `Bet lost — ${gameName} · ticket ${bet.ticketId}`,
      });
      await notify(bet.userId, "bet_lost", "Bet Lost", `Your bet on ${gameName} did not win. Better luck next time!`);
      const [lostUser] = await db.select().from(usersTable).where(eq(usersTable.id, bet.userId)).limit(1);
      if (lostUser?.email) {
        sendMail({
          to: lostUser.email,
          subject: `Bet Result – ATA Sports Live`,
          html: templates.betLost({
            name: lostUser.fullName ?? lostUser.email,
            stake: parseFloat(bet.stake as string),
            gameName,
          }),
        }).catch(() => {});
      }
    }
    await notify(bet.userId, "match_result", "Match Result", `${gameName} result: ${result.replace(/_/g, " ")}`);
  }

  // 2. Refund all still-pending (unmatched) bets — the event is over, they can no longer be matched
  const pendingBets = await db.select().from(betsTable).where(and(eq(betsTable.gameId, id), eq(betsTable.status, "pending")));

  for (const bet of pendingBets) {
    const refund = parseFloat(bet.stake as string);
    await db.update(betsTable).set({ status: "refunded", settledAt: new Date() }).where(eq(betsTable.id, bet.id));
    await db.update(walletsTable).set({
      balance: sql`balance + ${refund}`,
      availableBalance: sql`available_balance + ${refund}`,
      pendingBalance: sql`GREATEST(0, pending_balance - ${refund})`,
    }).where(eq(walletsTable.userId, bet.userId));
    await db.insert(transactionsTable).values({
      transactionId: `REF-${uuidv4().split("-")[0].toUpperCase()}`,
      userId: bet.userId,
      type: "bet_refund",
      amount: refund.toString(),
      status: "completed",
      paymentMethod: "internal",
      description: `Unmatched bet refund — ${gameName} · ticket ${bet.ticketId}`,
    });
    await notify(bet.userId, "bet_refunded", "Unmatched Bet Refunded", `Your unmatched bet of $${refund.toFixed(2)} on ${gameName} has been refunded.`);
  }

  await db.update(gamesTable).set({ openBetsCount: 0 }).where(eq(gamesTable.id, id));

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
        pendingBalance: sql`pending_balance - ${refund}`,
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

// Auth required — stakes and user IDs must not be public
router.get("/:id/bets", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const gameId = Number(req.params.id);
  const bets = await db.select().from(betsTable).where(eq(betsTable.gameId, gameId));
  const games = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId)).limit(1);
  const game = games[0];
  const requesterId = req.userId!;
  res.json(bets.map((b) => ({
    id: b.id,
    ticketId: b.ticketId,
    // Only expose userId to the owner of the bet; others see null
    userId: b.userId === requesterId ? b.userId : null,
    isOwn: b.userId === requesterId,
    gameId: b.gameId,
    game: game ? toGame(game) : null,
    outcome: b.outcome,
    // Only expose stake to the owner; others see null
    stake: b.userId === requesterId ? parseFloat(b.stake as string) : null,
    potentialReturn: b.userId === requesterId ? parseFloat(b.potentialReturn as string) : null,
    status: b.status,
    matchedBetId: b.matchedBetId,
    createdAt: b.createdAt,
    settledAt: b.settledAt,
  })));
});

export default router;
