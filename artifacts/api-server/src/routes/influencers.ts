import { Router } from "express";
import { eq, sql, desc } from "drizzle-orm";
import { db, usersTable, transactionsTable } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";

const router = Router();

// ── GET /api/influencers/my-referrals ────────────────────────────────────────
// Influencer sees all users who signed up via their referral code
router.get("/my-referrals", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;

  const [me] = await db
    .select({ isInfluencer: usersTable.isInfluencer })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!me?.isInfluencer) {
    res.status(403).json({ error: "Not an influencer account" });
    return;
  }

  const referrals = await db
    .select({
      id: usersTable.id,
      fullName: usersTable.fullName,
      username: usersTable.username,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.referredBy, userId))
    .orderBy(desc(usersTable.createdAt));

  // Fetch total commission earned
  const commissions = await db.execute(
    sql`SELECT amount FROM transactions
        WHERE user_id = ${userId}
          AND type = 'influencer_commission'
          AND status = 'completed'`
  );
  const totalEarned = (commissions.rows as any[]).reduce(
    (sum: number, r: any) => sum + parseFloat(r.amount || "0"),
    0
  );

  res.json({
    referrals: referrals.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      username: u.username,
      joinedAt: u.createdAt,
    })),
    totalReferrals: referrals.length,
    totalCommissionEarned: Math.round(totalEarned * 100) / 100,
  });
});

// ── PATCH /api/influencers/my-referral-code ──────────────────────────────────
// Let an influencer pick their own referral code/link once, to make it easier
// for them to share with their followers. One-time only — locked after first use.
router.patch("/my-referral-code", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;

  const [me] = await db
    .select({ isInfluencer: usersTable.isInfluencer, referralCodeCustomized: usersTable.referralCodeCustomized })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!me?.isInfluencer) {
    res.status(403).json({ error: "Not an influencer account" });
    return;
  }
  if (me.referralCodeCustomized) {
    res.status(403).json({ error: "You've already customized your referral code. This can only be done once." });
    return;
  }

  const { code } = req.body as { code?: string };
  const trimmed = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{4,20}$/.test(trimmed)) {
    res.status(400).json({ error: "Code must be 4-20 characters: letters, numbers, underscores, or hyphens only" });
    return;
  }

  try {
    const result = await db.execute(
      sql`UPDATE users SET referral_code = ${trimmed}, referral_code_customized = true
          WHERE id = ${userId} AND referral_code_customized = false`
    );
    if ((result.rowCount ?? 0) === 0) {
      res.status(403).json({ error: "You've already customized your referral code. This can only be done once." });
      return;
    }
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "That code is already taken. Please choose another." });
      return;
    }
    throw err;
  }

  res.json({ ok: true, referralCode: trimmed, referralCodeCustomized: true });
});

// ── GET /api/influencers/my-commission-history ───────────────────────────────
router.get("/my-commission-history", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;
  const [me] = await db
    .select({ isInfluencer: usersTable.isInfluencer })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!me?.isInfluencer) {
    res.status(403).json({ error: "Not an influencer account" });
    return;
  }

  const history = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(50);

  const filtered = history.filter((t: typeof history[number]) => t.type === "influencer_commission");

  res.json(
    filtered.map((t: typeof history[number]) => ({
      id: t.id,
      amount: parseFloat(t.amount as string),
      description: t.description,
      createdAt: t.createdAt,
    }))
  );
});

export default router;
