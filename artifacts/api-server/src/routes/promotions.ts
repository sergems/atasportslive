import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, walletsTable, promotionsTable, bonusTransactionsTable, promotionTermsAcceptanceTable, transactionsTable } from "@workspace/db";
import { eq, and, lte, gte, or, isNull, sql, desc } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { notify } from "../lib/notify";

const router = Router();

function calcBonus(promo: typeof promotionsTable.$inferSelect, depositAmount: number): number {
  let bonus = 0;
  if (promo.bonusType === "percentage" && promo.percentage) {
    bonus = (depositAmount * parseFloat(promo.percentage as string)) / 100;
  } else if (promo.bonusType === "fixed" && promo.fixedAmount) {
    bonus = parseFloat(promo.fixedAmount as string);
  }
  if (promo.maxBonus) {
    bonus = Math.min(bonus, parseFloat(promo.maxBonus as string));
  }
  return Math.round(bonus * 100) / 100;
}

export async function findMatchingAutoPromo(depositAmount: number) {
  const now = new Date();
  const promos = await db
    .select()
    .from(promotionsTable)
    .where(
      and(
        eq(promotionsTable.status, "active"),
        sql`${promotionsTable.type} IN ('automatic', 'deposit_match', 'welcome', 'seasonal')`,
        or(isNull(promotionsTable.startDate), lte(promotionsTable.startDate, now)),
        or(isNull(promotionsTable.endDate), gte(promotionsTable.endDate, now)),
        or(isNull(promotionsTable.maxUses), sql`used_count < max_uses`),
        sql`COALESCE(min_deposit, 0) <= ${depositAmount}`
      )
    )
    .orderBy(desc(promotionsTable.createdAt))
    .limit(1);
  return promos[0] || null;
}

export async function creditBonus(userId: number, promo: typeof promotionsTable.$inferSelect, depositAmount: number, ip?: string): Promise<number> {
  const bonusAmount = calcBonus(promo, depositAmount);
  if (bonusAmount <= 0) return 0;

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
  const balBefore = parseFloat((wallet?.bonusBalance as string) || "0");
  const balAfter = balBefore + bonusAmount;

  const expiresAt = promo.bonusExpiryDays
    ? new Date(Date.now() + promo.bonusExpiryDays * 86400_000)
    : null;

  await db.update(walletsTable).set({
    bonusBalance: sql`bonus_balance + ${bonusAmount}`,
  }).where(eq(walletsTable.userId, userId));

  await db.insert(bonusTransactionsTable).values({
    userId,
    promotionId: promo.id,
    type: "earned",
    amount: bonusAmount.toFixed(2),
    balanceBefore: balBefore.toFixed(2),
    balanceAfter: balAfter.toFixed(2),
    reference: `BONUS-${uuidv4().split("-")[0].toUpperCase()}`,
    expiresAt,
    description: `Bonus from: ${promo.name}`,
  });

  await db.update(promotionsTable).set({
    usedCount: sql`used_count + 1`,
  }).where(eq(promotionsTable.id, promo.id));

  await db.insert(promotionTermsAcceptanceTable).values({
    userId,
    promotionId: promo.id,
    ipAddress: ip || null,
    version: "1.0",
  }).onConflictDoNothing();

  await notify(userId, "deposit_received",
    "🎁 Bonus Credit Added!",
    `You've received a $${bonusAmount.toFixed(2)} bonus from "${promo.name}". Use it for live streaming!`
  );

  if (expiresAt) {
    const threeDays = new Date(expiresAt.getTime() - 3 * 86400_000);
    if (threeDays > new Date()) {
      setTimeout(async () => {
        await notify(userId, "deposit_received", "⚠️ Bonus Expiring Soon",
          `Your $${bonusAmount.toFixed(2)} bonus from "${promo.name}" expires in 3 days.`);
      }, threeDays.getTime() - Date.now());
    }
  }

  return bonusAmount;
}

// ── Public: list active promotions ──────────────────────────────────────────

router.get("/active", async (_req, res): Promise<void> => {
  const now = new Date();
  const promos = await db
    .select()
    .from(promotionsTable)
    .where(
      and(
        eq(promotionsTable.status, "active"),
        or(isNull(promotionsTable.startDate), lte(promotionsTable.startDate, now)),
        or(isNull(promotionsTable.endDate), gte(promotionsTable.endDate, now))
      )
    )
    .orderBy(desc(promotionsTable.createdAt));

  res.json(promos.map(p => ({
    id: p.id, name: p.name, code: p.code, type: p.type, bonusType: p.bonusType,
    percentage: p.percentage ? parseFloat(p.percentage as string) : null,
    fixedAmount: p.fixedAmount ? parseFloat(p.fixedAmount as string) : null,
    minDeposit: parseFloat(p.minDeposit as string),
    maxBonus: p.maxBonus ? parseFloat(p.maxBonus as string) : null,
    description: p.description, bannerImageUrl: p.bannerImageUrl,
    termsConditions: p.termsConditions, bonusExpiryDays: p.bonusExpiryDays,
    endDate: p.endDate,
  })));
});

// ── Validate promo code ──────────────────────────────────────────────────────

router.post("/validate-code", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { code, depositAmount } = req.body;
  if (!code) { res.status(400).json({ valid: false, reason: "Code is required" }); return; }

  const now = new Date();
  const [promo] = await db.select().from(promotionsTable).where(
    and(
      eq(promotionsTable.code, code.trim().toUpperCase()),
      eq(promotionsTable.status, "active"),
      or(isNull(promotionsTable.startDate), lte(promotionsTable.startDate, now)),
      or(isNull(promotionsTable.endDate), gte(promotionsTable.endDate, now))
    )
  ).limit(1);

  if (!promo) { res.status(404).json({ valid: false, reason: "Code not found or expired" }); return; }
  if (promo.maxUses && promo.usedCount >= promo.maxUses) {
    res.status(400).json({ valid: false, reason: "This promotion has reached its usage limit" }); return;
  }
  const minDep = parseFloat(promo.minDeposit as string);
  if (depositAmount && Number(depositAmount) < minDep) {
    res.status(200).json({ valid: false, reason: `Minimum deposit of ${minDep.toFixed(2)} required` }); return;
  }

  const bonusAmount = calcBonus(promo, Number(depositAmount) || minDep);
  res.json({
    valid: true,
    promotion: {
      id: promo.id, name: promo.name, bonusType: promo.bonusType,
      percentage: promo.percentage ? parseFloat(promo.percentage as string) : null,
      fixedAmount: promo.fixedAmount ? parseFloat(promo.fixedAmount as string) : null,
      termsConditions: promo.termsConditions,
    },
    estimatedBonus: bonusAmount,
  });
});

// ── Claim bonus (after terms acceptance) ─────────────────────────────────────

router.post("/claim", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { promotionId, depositTransactionId } = req.body;
  if (!promotionId) { res.status(400).json({ error: "promotionId required" }); return; }

  const [promo] = await db.select().from(promotionsTable).where(eq(promotionsTable.id, Number(promotionId))).limit(1);
  if (!promo || promo.status !== "active") { res.status(404).json({ error: "Promotion not found or not active" }); return; }

  const [alreadyAccepted] = await db.select().from(promotionTermsAcceptanceTable).where(
    and(eq(promotionTermsAcceptanceTable.userId, req.userId!), eq(promotionTermsAcceptanceTable.promotionId, promo.id))
  ).limit(1);
  if (alreadyAccepted) { res.status(400).json({ error: "Bonus already claimed for this promotion" }); return; }

  let depositAmount = 0;
  if (depositTransactionId) {
    const [tx] = await db.select().from(transactionsTable).where(
      and(eq(transactionsTable.transactionId, depositTransactionId), eq(transactionsTable.userId, req.userId!))
    ).limit(1);
    if (tx) depositAmount = parseFloat(tx.amount as string);
  }

  const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || undefined;
  const bonusAmount = await creditBonus(req.userId!, promo, depositAmount, ip);

  res.json({ ok: true, bonusAmount, message: `$${bonusAmount.toFixed(2)} bonus credited to your account!` });
});

// ── Apply promo code manually ─────────────────────────────────────────────────

router.post("/apply-code", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { code, depositTransactionId } = req.body;
  if (!code) { res.status(400).json({ error: "Code required" }); return; }

  const now = new Date();
  const [promo] = await db.select().from(promotionsTable).where(
    and(
      eq(promotionsTable.code, code.trim().toUpperCase()),
      eq(promotionsTable.status, "active"),
      or(isNull(promotionsTable.startDate), lte(promotionsTable.startDate, now)),
      or(isNull(promotionsTable.endDate), gte(promotionsTable.endDate, now))
    )
  ).limit(1);

  if (!promo) { res.status(404).json({ error: "Invalid or expired promo code" }); return; }
  if (promo.maxUses && promo.usedCount >= promo.maxUses) {
    res.status(400).json({ error: "This promotion has reached its usage limit" }); return;
  }

  const [alreadyClaimed] = await db.select().from(promotionTermsAcceptanceTable).where(
    and(eq(promotionTermsAcceptanceTable.userId, req.userId!), eq(promotionTermsAcceptanceTable.promotionId, promo.id))
  ).limit(1);
  if (alreadyClaimed) { res.status(400).json({ error: "You have already claimed this promo code" }); return; }

  let depositAmount = 0;
  if (depositTransactionId) {
    const [tx] = await db.select().from(transactionsTable).where(
      and(eq(transactionsTable.transactionId, depositTransactionId), eq(transactionsTable.userId, req.userId!))
    ).limit(1);
    if (tx) depositAmount = parseFloat(tx.amount as string);
  }
  if (depositAmount < parseFloat(promo.minDeposit as string)) {
    res.status(400).json({ error: `Minimum deposit of $${parseFloat(promo.minDeposit as string).toFixed(2)} required` }); return;
  }

  const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || undefined;
  const bonusAmount = await creditBonus(req.userId!, promo, depositAmount, ip);

  res.json({ ok: true, bonusAmount, message: `$${bonusAmount.toFixed(2)} bonus credited from code "${promo.code}"!` });
});

// ── User bonus history ────────────────────────────────────────────────────────

router.get("/my-bonuses", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const txs = await db
    .select({ bt: bonusTransactionsTable, promo: promotionsTable })
    .from(bonusTransactionsTable)
    .leftJoin(promotionsTable, eq(bonusTransactionsTable.promotionId, promotionsTable.id))
    .where(eq(bonusTransactionsTable.userId, req.userId!))
    .orderBy(desc(bonusTransactionsTable.createdAt))
    .limit(50);

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.userId!)).limit(1);

  res.json({
    bonusBalance: parseFloat((wallet?.bonusBalance as string) || "0"),
    transactions: txs.map(({ bt, promo }) => ({
      id: bt.id,
      type: bt.type,
      amount: parseFloat(bt.amount as string),
      balanceBefore: parseFloat(bt.balanceBefore as string),
      balanceAfter: parseFloat(bt.balanceAfter as string),
      reference: bt.reference,
      expiresAt: bt.expiresAt,
      description: bt.description,
      promotionName: promo?.name || null,
      createdAt: bt.createdAt,
    })),
  });
});

export default router;
