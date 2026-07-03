import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, streamsTable, streamAccessTable, walletsTable, transactionsTable, gamesTable, bonusTransactionsTable, usersTable } from "@workspace/db";
import { eq, desc, sql, and, gt, ne, or, gte, isNull } from "drizzle-orm";
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
  const includeAll = req.query.include_all === 'true';
  const offset = (page - 1) * limit;

  const whereClause = status
    ? eq(streamsTable.status, status as any)
    : includeAll
    ? undefined
    : ne(streamsTable.status, 'ended' as any);

  let q = db.select().from(streamsTable).$dynamic();
  if (whereClause) q = q.where(whereClause);

  const countQ = db.select({ count: sql<number>`count(*)` }).from(streamsTable);
  const [{ count }] = whereClause ? await countQ.where(whereClause) : await countQ;
  const streams = await q.orderBy(desc(streamsTable.startTime)).limit(limit).offset(offset);
  res.json({ streams: streams.map(toStream), total: Number(count), page, limit });
});

router.get("/upcoming", async (req, res): Promise<void> => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const streams = await db
    .select()
    .from(streamsTable)
    .where(
      or(
        eq(streamsTable.status, "live" as any),
        and(
          eq(streamsTable.status, "upcoming" as any),
          gte(streamsTable.startTime, todayStart)
        )
      )
    )
    .orderBy(streamsTable.startTime)
    .limit(20);

  res.json(streams.map((s) => ({
    ...toStream(s),
    secondsUntilStart: Math.max(0, Math.floor((new Date(s.startTime).getTime() - now.getTime()) / 1000)),
  })));
});

router.post("/", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const { title, description, sport, thumbnailUrl, startTime, endTime, accessPrice, playerA, playerB, city, country } = req.body;
  if (!title || !sport || !startTime) {
    res.status(400).json({ error: "title, sport, startTime required" });
    return;
  }

  const GAME_SPORTS = ["pool", "boxing", "darts", "fifa", "chess", "futsal"];
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

router.patch("/:id", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
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

  // Read subscription type from request body (default daily)
  const subType: "daily" | "weekly" | "monthly" | "yearly" = ["daily","weekly","monthly","yearly"].includes(req.body?.subscriptionType)
    ? req.body.subscriptionType
    : "daily";

  // Load subscription prices from settings (fall back to hardcoded defaults)
  const priceRows = await db.execute(sql`SELECT key, value FROM settings WHERE key IN ('price_daily','price_weekly','price_monthly','price_yearly')`);
  const priceMap: Record<string, string> = {};
  for (const r of priceRows.rows as { key: string; value: string }[]) priceMap[r.key] = r.value;
  const parsePriceSafe = (raw: string | undefined, fallback: number): number => {
    const n = parseFloat(raw ?? "");
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const PRICES: Record<string, number> = {
    daily:   parsePriceSafe(priceMap["price_daily"],   parseFloat(stream.accessPrice as string ?? "1.70") || 1.70),
    weekly:  parsePriceSafe(priceMap["price_weekly"],  7.00),
    monthly: parsePriceSafe(priceMap["price_monthly"], 20.00),
    yearly:  parsePriceSafe(priceMap["price_yearly"],  99.00),
  };
  const DURATIONS_MS: Record<string, number> = {
    daily:   1  * 24 * 60 * 60 * 1000,
    weekly:  7  * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
    yearly:  365 * 24 * 60 * 60 * 1000,
  };
  const DURATION_LABELS: Record<string, string> = {
    daily: "24-hour", weekly: "7-day", monthly: "30-day", yearly: "365-day",
  };

  const price = PRICES[subType];
  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);

  const cashAvailable = parseFloat(wallet?.availableBalance as string || "0");
  const bonusAvailable = parseFloat((wallet?.bonusBalance as string) || "0");
  const totalAvailable = cashAvailable + bonusAvailable;

  if (!wallet || totalAvailable < price) {
    res.status(402).json({ error: "Insufficient wallet balance" });
    return;
  }

  // Check prior PAID stream_access count BEFORE inserting — determines if this is the first paid purchase
  const [{ priorCount }] = await db
    .select({ priorCount: sql<number>`count(*)` })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.userId, userId),
      eq(transactionsTable.type, "stream_access"),
      gt(transactionsTable.amount, "0"),
    ));
  const isFirstPurchase = Number(priorCount) === 0;

  // Use bonus first, then cash for remainder
  const bonusUsed = Math.min(bonusAvailable, price);
  const cashUsed = Math.round((price - bonusUsed) * 100) / 100;
  const durationLabel = DURATION_LABELS[subType];
  const desc_txt = bonusUsed > 0
    ? `${durationLabel} access to: ${stream.title} (bonus ${bonusUsed.toFixed(2)} + cash ${cashUsed.toFixed(2)})`
    : `${durationLabel} access to: ${stream.title}`;
  const expiresAt = new Date(now.getTime() + DURATIONS_MS[subType]);

  // Wrap all financial writes in a single atomic transaction so a mid-flight
  // failure cannot leave the wallet debited but no access granted (or vice versa).
  await db.transaction(async (tx) => {
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
        description: `Bonus used for: ${stream.title}`,
      });
    }

    if (cashUsed > 0) {
      await tx.update(walletsTable).set({
        balance: sql`balance - ${cashUsed}`,
        availableBalance: sql`available_balance - ${cashUsed}`,
        withdrawableBalance: sql`withdrawable_balance - ${cashUsed}`,
      }).where(eq(walletsTable.userId, userId));
    }

    await tx.insert(transactionsTable).values({
      transactionId: `STR-${uuidv4().split("-")[0].toUpperCase()}`,
      userId,
      type: "stream_access",
      amount: price.toString(),
      status: "completed",
      paymentMethod: "internal",
      description: desc_txt,
    });

    await tx.insert(streamAccessTable).values({ userId, streamId, grantedAt: now, expiresAt, subscriptionType: subType });
  });

  // ── Referral bonus: configurable % of stream price to referrer on first paid purchase ──
  if (isFirstPurchase) {
    const [userRecord] = await db
      .select({ referredBy: usersTable.referredBy, fullName: usersTable.fullName, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (userRecord?.referredBy) {
      const pctRows = await db.execute(sql`SELECT value FROM settings WHERE key = 'referral_bonus_pct' LIMIT 1`);
      const pctRow = (pctRows.rows as { value: string }[])[0];
      const referralPct = pctRow?.value ? Math.min(Math.max(parseFloat(pctRow.value), 0), 100) / 100 : 0.10;
      const bonusAmount = Math.round(price * referralPct * 100) / 100;
      if (bonusAmount > 0) {
        const [referrerWallet] = await db
          .select()
          .from(walletsTable)
          .where(eq(walletsTable.userId, userRecord.referredBy))
          .limit(1);

        if (referrerWallet) {
          // Idempotency guard — ensure we haven't already credited this referral
          const referralRef = `REF-USER-${userId}`;
          const [alreadyCredited] = await db
            .select({ id: bonusTransactionsTable.id })
            .from(bonusTransactionsTable)
            .where(and(
              eq(bonusTransactionsTable.userId, userRecord.referredBy),
              eq(bonusTransactionsTable.reference, referralRef),
            ))
            .limit(1);

          if (!alreadyCredited) {
            const referrerBonusBefore = parseFloat(referrerWallet.bonusBalance as string || "0");
            const referrerBonusAfter = referrerBonusBefore + bonusAmount;

            await db.update(walletsTable).set({
              bonusBalance: sql`bonus_balance + ${bonusAmount}`,
            }).where(eq(walletsTable.userId, userRecord.referredBy));

            await db.insert(bonusTransactionsTable).values({
              userId: userRecord.referredBy,
              type: "earned",
              amount: bonusAmount.toFixed(2),
              balanceBefore: referrerBonusBefore.toFixed(2),
              balanceAfter: referrerBonusAfter.toFixed(2),
              reference: referralRef,
              description: `${(referralPct * 100).toFixed(0)}% referral bonus — ${userRecord.fullName || userRecord.email} purchased their first stream`,
              expiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000), // 90-day expiry
            });

            await notify(
              userRecord.referredBy,
              "general",
              "Referral Bonus Earned! 🎉",
              `You earned a ${bonusAmount.toFixed(2)} bonus — ${userRecord.fullName || "Your referral"} just purchased their first stream!`
            );
          }
        }
      }
    }
  }

  // Low balance check
  const [updatedWallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
  if (parseFloat(updatedWallet.availableBalance as string) < 3) {
    await notify(userId, "low_balance", "Low Balance Alert", "Your wallet balance is below $3. Top up to continue watching.");
  }

  res.json({ hasAccess: true, expiresAt, secondsRemaining: Math.floor(DURATIONS_MS[subType] / 1000), subscriptionType: subType });
});

router.get("/:id/access/check", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const streamId = Number(req.params.id);
  const userId = req.userId!;
  const now = new Date();

  // Check per-stream access first
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
    res.json({ hasAccess: true, expiresAt: access.expiresAt, secondsRemaining, accessType: "stream" });
    return;
  }

  // Fall through: check for an active platform subscription
  const [platformSub] = await db.execute(sql`
    SELECT id, expires_at FROM platform_subscriptions
    WHERE user_id = ${userId} AND expires_at > ${now}
    ORDER BY expires_at DESC
    LIMIT 1
  `).then((r) => r.rows as { id: number; expires_at: Date }[]);

  if (platformSub) {
    const expiresAt = new Date(platformSub.expires_at);
    const secondsRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
    res.json({ hasAccess: true, expiresAt, secondsRemaining, accessType: "platform" });
    return;
  }

  res.json({ hasAccess: false, expiresAt: null, secondsRemaining: null });
});

router.patch("/:id/go-live", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const { hlsUrl, streamKey } = req.body;
  const [stream] = await db
    .update(streamsTable)
    .set({ status: "live", hlsUrl, streamKey: streamKey || null })
    .where(eq(streamsTable.id, Number(req.params.id)))
    .returning();
  res.json(toStream(stream));
});

router.patch("/:id/end", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const [stream] = await db
    .update(streamsTable)
    .set({ status: "ended", endTime: new Date() })
    .where(eq(streamsTable.id, Number(req.params.id)))
    .returning();
  res.json(toStream(stream));
});

export default router;
