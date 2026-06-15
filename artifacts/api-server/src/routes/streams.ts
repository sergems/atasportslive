import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, streamsTable, streamAccessTable, walletsTable, transactionsTable, gamesTable } from "@workspace/db";
import { eq, desc, sql, and, gt } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { notify } from "../lib/notify";

const router = Router();

const toStream = (s: typeof streamsTable.$inferSelect) => ({
  id: s.id,
  title: s.title,
  description: s.description,
  sport: s.sport,
  thumbnailUrl: s.thumbnailUrl,
  hlsUrl: s.hlsUrl,
  streamKey: s.streamKey,
  status: s.status,
  startTime: s.startTime,
  endTime: s.endTime,
  viewerCount: s.viewerCount,
  accessPrice: parseFloat(s.accessPrice as string),
  createdAt: s.createdAt,
});

router.get("/", async (req, res): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const status = req.query.status as string | undefined;
  const offset = (page - 1) * limit;

  let q = db.select().from(streamsTable).$dynamic();
  if (status) q = q.where(eq(streamsTable.status, status as any));

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(streamsTable);
  const streams = await q.orderBy(desc(streamsTable.startTime)).limit(limit).offset(offset);
  res.json({ streams: streams.map(toStream), total: Number(count), page, limit });
});

router.get("/upcoming", async (req, res): Promise<void> => {
  const now = new Date();
  const streams = await db
    .select()
    .from(streamsTable)
    .where(eq(streamsTable.status, "upcoming"))
    .orderBy(streamsTable.startTime)
    .limit(10);

  res.json(streams.map((s) => ({
    ...toStream(s),
    secondsUntilStart: Math.max(0, Math.floor((new Date(s.startTime).getTime() - now.getTime()) / 1000)),
  })));
});

router.post("/", authMiddleware, requireRole("admin", "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const { title, description, sport, thumbnailUrl, startTime, endTime, accessPrice, playerA, playerB } = req.body;
  if (!title || !sport || !startTime) {
    res.status(400).json({ error: "title, sport, startTime required" });
    return;
  }

  const GAME_SPORTS = ["pool", "boxing", "football", "athletics", "basketball"];
  const createsGame = GAME_SPORTS.includes(sport);

  if (createsGame && (!playerA || !playerB)) {
    res.status(400).json({ error: "playerA and playerB are required for non-tournament streams" });
    return;
  }

  const [stream] = await db
    .insert(streamsTable)
    .values({
      title,
      description,
      sport,
      thumbnailUrl,
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : null,
      accessPrice: accessPrice?.toString() || "1.50",
    })
    .returning();

  if (createsGame) {
    const start = new Date(startTime);
    const eventDate = start.toISOString().split("T")[0];
    const eventTime = start.toTimeString().slice(0, 5);
    await db.insert(gamesTable).values({ sport, playerA, playerB, eventDate, eventTime });
  }

  res.status(201).json(toStream(stream));
});

router.get("/:id", async (req, res): Promise<void> => {
  const [stream] = await db.select().from(streamsTable).where(eq(streamsTable.id, Number(req.params.id))).limit(1);
  if (!stream) {
    res.status(404).json({ error: "Stream not found" });
    return;
  }
  res.json(toStream(stream));
});

router.patch("/:id", authMiddleware, requireRole("admin", "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const { title, description, sport, thumbnailUrl, startTime, endTime, status, hlsUrl, accessPrice } = req.body;
  const updates: Record<string, any> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (sport !== undefined) updates.sport = sport;
  if (thumbnailUrl !== undefined) updates.thumbnailUrl = thumbnailUrl;
  if (startTime !== undefined) updates.startTime = new Date(startTime);
  if (endTime !== undefined) updates.endTime = new Date(endTime);
  if (status !== undefined) updates.status = status;
  if (hlsUrl !== undefined) updates.hlsUrl = hlsUrl;
  if (accessPrice !== undefined) updates.accessPrice = accessPrice.toString();

  const [stream] = await db.update(streamsTable).set(updates).where(eq(streamsTable.id, id)).returning();
  res.json(toStream(stream));
});

router.delete("/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  await db.delete(streamsTable).where(eq(streamsTable.id, Number(req.params.id)));
  res.json({ message: "Stream deleted" });
});

router.post("/:id/access", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const streamId = Number(req.params.id);
  const userId = req.userId!;

  const [stream] = await db.select().from(streamsTable).where(eq(streamsTable.id, streamId)).limit(1);
  if (!stream) {
    res.status(404).json({ error: "Stream not found" });
    return;
  }

  // Check existing valid access
  const now = new Date();
  const [existing] = await db
    .select()
    .from(streamAccessTable)
    .where(and(eq(streamAccessTable.userId, userId), eq(streamAccessTable.streamId, streamId), gt(streamAccessTable.expiresAt, now)))
    .limit(1);
  if (existing) {
    res.json({ hasAccess: true, expiresAt: existing.expiresAt, secondsRemaining: Math.floor((existing.expiresAt.getTime() - now.getTime()) / 1000) });
    return;
  }

  const price = parseFloat(stream.accessPrice as string);
  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
  if (!wallet || parseFloat(wallet.availableBalance as string) < price) {
    res.status(402).json({ error: "Insufficient wallet balance" });
    return;
  }

  // Deduct from wallet
  await db.update(walletsTable).set({
    balance: sql`balance - ${price}`,
    availableBalance: sql`available_balance - ${price}`,
    withdrawableBalance: sql`withdrawable_balance - ${price}`,
  }).where(eq(walletsTable.userId, userId));

  await db.insert(transactionsTable).values({
    transactionId: `STR-${uuidv4().split("-")[0].toUpperCase()}`,
    userId,
    type: "stream_access",
    amount: price.toString(),
    status: "completed",
    paymentMethod: "internal",
    description: `24h access to: ${stream.title}`,
  });

  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  await db.insert(streamAccessTable).values({ userId, streamId, grantedAt: now, expiresAt });

  // Low balance check
  const [updatedWallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
  if (parseFloat(updatedWallet.availableBalance as string) < 3) {
    await notify(userId, "low_balance", "Low Balance Alert", "Your wallet balance is below $3. Top up to continue watching.");
  }

  res.json({ hasAccess: true, expiresAt, secondsRemaining: 24 * 60 * 60 });
});

router.get("/:id/access/check", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const streamId = Number(req.params.id);
  const userId = req.userId!;
  const now = new Date();

  const [access] = await db
    .select()
    .from(streamAccessTable)
    .where(and(eq(streamAccessTable.userId, userId), eq(streamAccessTable.streamId, streamId), gt(streamAccessTable.expiresAt, now)))
    .limit(1);

  if (access) {
    const secondsRemaining = Math.floor((access.expiresAt.getTime() - now.getTime()) / 1000);
    if (secondsRemaining < 3600) {
      await notify(userId, "stream_expiring", "Stream Access Expiring", "Your stream access expires in less than 1 hour.");
    }
    res.json({ hasAccess: true, expiresAt: access.expiresAt, secondsRemaining });
  } else {
    res.json({ hasAccess: false, expiresAt: null, secondsRemaining: null });
  }
});

router.patch("/:id/go-live", authMiddleware, requireRole("admin", "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const { hlsUrl, streamKey } = req.body;
  const [stream] = await db
    .update(streamsTable)
    .set({ status: "live", hlsUrl, streamKey: streamKey || null })
    .where(eq(streamsTable.id, Number(req.params.id)))
    .returning();
  res.json(toStream(stream));
});

router.patch("/:id/end", authMiddleware, requireRole("admin", "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const [stream] = await db
    .update(streamsTable)
    .set({ status: "ended", endTime: new Date() })
    .where(eq(streamsTable.id, Number(req.params.id)))
    .returning();
  res.json(toStream(stream));
});

export default router;
