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

  let query = db.select().from(usersTable);
  const conditions = [];
  if (search) {
    conditions.push(or(ilike(usersTable.fullName, `%${search}%`), ilike(usersTable.email, `%${search}%`)));
  }
  if (role) {
    conditions.push(eq(usersTable.role, role as "user" | "admin" | "moderator" | "guest"));
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usersTable);

  const users = await db.select().from(usersTable).limit(limit).offset(offset);
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

export default router;
