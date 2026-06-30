import { Router } from "express";
import bcrypt from "bcrypt";
import { db, usersTable } from "@workspace/db";
import { eq, ilike, or, sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";

const router = Router();

const toPublicUser = (user: typeof usersTable.$inferSelect) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  phone: user.phone,
  role: user.role,
  status: user.status,
  avatarUrl: user.avatarUrl,
  createdAt: user.createdAt,
});

router.get("/", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const search = req.query.search as string | undefined;
  const role = req.query.role as string | undefined;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search) {
    conditions.push(or(ilike(usersTable.fullName, `%${search}%`), ilike(usersTable.email, `%${search}%`)));
  }
  if (role) {
    conditions.push(eq(usersTable.role, role as "user" | "admin" | "moderator" | "guest"));
  }

  const whereClause = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : conditions.reduce((a, b) => sql`${a} AND ${b}`)) : undefined;

  const countQuery = db.select({ count: sql<number>`count(*)` }).from(usersTable);
  const [{ count }] = whereClause ? await countQuery.where(whereClause as any) : await countQuery;

  const usersQuery = db.select().from(usersTable);
  const users = whereClause
    ? await usersQuery.where(whereClause as any).limit(limit).offset(offset)
    : await usersQuery.limit(limit).offset(offset);
  res.json({ users: users.map(toPublicUser), total: Number(count), page, limit });
});

router.get("/:id", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  if (req.userId !== id && req.userRole !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(toPublicUser(user));
});

router.patch("/:id", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  if (req.userId !== id && req.userRole !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const { fullName, phone, avatarUrl } = req.body;
  const [user] = await db
    .update(usersTable)
    .set({ fullName, phone, avatarUrl })
    .where(eq(usersTable.id, id))
    .returning();
  res.json(toPublicUser(user));
});

router.patch("/:id/role", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const { role } = req.body;
  if (!["user", "moderator", "admin"].includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  const [user] = await db
    .update(usersTable)
    .set({ role })
    .where(eq(usersTable.id, id))
    .returning();
  res.json(toPublicUser(user));
});

router.patch("/:id/suspend", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const { suspended } = req.body;
  const [user] = await db
    .update(usersTable)
    .set({ status: suspended ? "suspended" : "active" })
    .where(eq(usersTable.id, id))
    .returning();
  res.json(toPublicUser(user));
});

router.patch("/:id/payout-method", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const { payoutMethod, payoutAccount } = req.body;
  const validMethods = ["mtn_momo", "airtel_money", "btc_binance"];
  if (!validMethods.includes(payoutMethod)) {
    res.status(400).json({ error: "Invalid payout method" });
    return;
  }
  if (!payoutAccount || !payoutAccount.trim()) {
    res.status(400).json({ error: "Payout account is required" });
    return;
  }
  await db.execute(
    sql`UPDATE users SET payout_method = ${payoutMethod}, payout_account = ${payoutAccount.trim()}, payout_method_set_at = NOW() WHERE id = ${id}`
  );
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  res.json({
    ...toPublicUser(user),
    payoutMethod,
    payoutAccount: payoutAccount.trim(),
  });
});

router.get("/:id/payout-method", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const rows = await db.execute(
    sql`SELECT payout_method, payout_account, payout_method_set_at FROM users WHERE id = ${id}`
  );
  const r = (rows.rows?.[0] as any) ?? null;
  if (!r) { res.status(404).json({ error: "User not found" }); return; }
  res.json({
    payoutMethod: r.payout_method ?? null,
    payoutAccount: r.payout_account ?? null,
    payoutMethodSetAt: r.payout_method_set_at ?? null,
  });
});

export default router;
