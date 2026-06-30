import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, streamsTable, streamAccessTable, walletsTable, transactionsTable, gamesTable, bonusTransactionsTable } from "@workspace/db";
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
  city: s.city,
  country: s.country,
  createdAt: s.createdAt,
});

router.get("/", async (req, res): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const status = req.query.status as string | undefined;
  const offset = (page - 1) * limit;

  let q = db.select().from(streamsTable).$dynamic();
  if (status) q = q.where(eq(streamsTable.status, status as any));

  const countQ = db.select({ count: sql<number>`count(*)` }).from(streamsTable);
  const [{ count }] = status ? await countQ.where(eq(streamsTable.status, status as any)) : await countQ;
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
  const { title, description, sport, thumbnailUrl, startTime, endTime, accessPrice, playerA, playerB, city, country } = req.body;
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
      city: city || null,
      country: country || null,
    })
    .returning();

  if (createsGame) {
    const start = new Date(startTime);
    const eventDate = start.toISOString().split("T")[0];
    const eventTime = start.toTimeString().slice(0, 5);
    const endDateStr = endTime ? new Date(endTime).toISOString().split("T")[0] : null;
    const endTimeStr = endTime ? new Date(endTime).toTimeString().slice(0, 5) : null;
    await db.insert(gamesTable).values({
      sport, playerA, playerB, eventDate, eventTime,
      eventEndDate: endDateStr,
      eventEndTime: endTimeStr,
      city: city || null,
      country: country || null,
    });
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
  const { title, description, sport, thumbnailUrl, startTime, endTime, status, hlsUrl, accessPrice, city, country } = req.body;
  const updates: Record<string, any> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (sport !== undefined) updates.sport = sport;
  if (thumbnailUrl !== undefined) updates.thumbnailUrl = thumbnailUrl;
  if (startTime !== undefined) updates.startTime = new Date(startTime);
  if (endTime !== undefined) updates.endTime = endTime ? new Date(endTime) : null;
  if (status !== undefined) updates.status = status;
  if (hlsUrl !== undefined) updates.hlsUrl = hlsUrl;
  if (accessPrice !== undefined) updates.accessPrice = accessPrice.toString();
  if (city !== undefined) updates.city = city || null;
  if (country !== undefined) updates.country = country || null;

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

  // Only allow purchase when the stream is actively live
  if (stream.status !== "live") {
    if (stream.status === "upcoming") {
      const goLiveAt = new Date(stream.startTime).toLocaleString("en-UG", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
      res.status(400).json({
        error: `This event is not broadcasting today. It is scheduled to go live on ${goLiveAt}. Please come back then to purchase access.`,
      });
    } else {
      res.status(400).json({ error: "This stream is no longer available for purchase." });
    }
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

  const cashAvailable = parseFloat(wallet?.availableBalance as string || "0");
  const bonusAvailable = parseFloat((wallet?.bonusBalance as string) || "0");
  const totalAvailable = cashAvailable + bonusAvailable;

  if (!wallet || totalAvailable < price) {
    res.status(402).json({ error: "Insufficient wallet balance" });
    return;
  }

  // Use bonus first, then cash for remainder
  const bonusUsed = Math.min(bonusAvailable, price);
  const cashUsed = Math.round((price - bonusUsed) * 100) / 100;

  if (bonusUsed > 0) {
    await db.update(walletsTable).set({
      bonusBalance: sql`bonus_balance - ${bonusUsed}`,
    }).where(eq(walletsTable.userId, userId));

    const balBefore = bonusAvailable;
    const balAfter = bonusAvailable - bonusUsed;
    await db.insert(bonusTransactionsTable).values({
      userId,
      type: "used",
      amount: bonusUsed.toFixed(2),
      balanceBefore: balBefore.toFixed(2),
      balanceAfter: balAfter.toFixed(2),
      description: `Bonus used for: ${stream.title}`,
    });
  }

  if (cashUsed > 0) {
    await db.update(walletsTable).set({
      balance: sql`balance - ${cashUsed}`,
      availableBalance: sql`available_balance - ${cashUsed}`,
      withdrawableBalance: sql`withdrawable_balance - ${cashUsed}`,
    }).where(eq(walletsTable.userId, userId));
  }

  const desc_txt = bonusUsed > 0
    ? `24h access to: ${stream.title} (bonus $${bonusUsed.toFixed(2)} + cash $${cashUsed.toFixed(2)})`
    : `24h access to: ${stream.title}`;

  await db.insert(transactionsTable).values({
    transactionId: `STR-${uuidv4().split("-")[0].toUpperCase()}`,
    userId,
    type: "stream_access",
    amount: price.toString(),
    status: "completed",
    paymentMethod: "internal",
    description: desc_txt,
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
