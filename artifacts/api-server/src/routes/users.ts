import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, ilike, or, sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";

const router = Router();

// Role hierarchy — must stay in sync with frontend ROLE_LEVELS
const ROLE_LEVELS: Record<string, number> = {
  user:           0,
  content_editor: 1,
  manager:        2,
  admin:          3,
};

function getRoleLevel(role?: string): number {
  return ROLE_LEVELS[role ?? ""] ?? -1;
}

/** Roles a given caller may see. null = no restriction (admin). */
function visibleRoles(callerRole: string): string[] | null {
  if (callerRole === "admin")          return null;                            // sees all
  if (callerRole === "manager")        return ["user", "content_editor", "manager"]; // not admin
  if (callerRole === "content_editor") return ["user"];                        // only regular users
  return [];
}

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

// ── List users ───────────────────────────────────────────────────────────────
router.get("/", authMiddleware, requireRole("admin", "manager", "content_editor"), async (req: AuthRequest, res): Promise<void> => {
  const page   = Number(req.query.page)  || 1;
  const limit  = Number(req.query.limit) || 20;
  const search = req.query.search as string | undefined;
  const roleQs = req.query.role  as string | undefined;
  const offset = (page - 1) * limit;

  const allowed = visibleRoles(req.userRole ?? "");

  const conditions: any[] = [];

  // Caller-level role filter — always applied first
  if (allowed !== null) {
    conditions.push(sql`${usersTable.role}::text = ANY(ARRAY[${sql.join(allowed.map(r => sql`${r}`), sql`, `)}])`);
  }

  // Optional search
  if (search) {
    conditions.push(or(ilike(usersTable.fullName, `%${search}%`), ilike(usersTable.email, `%${search}%`)));
  }

  // Optional role filter from query string — honour only if within allowed set
  if (roleQs) {
    if (allowed !== null && !allowed.includes(roleQs)) {
      res.json({ users: [], total: 0, page, limit });
      return;
    }
    conditions.push(sql`${usersTable.role}::text = ${roleQs}`);
  }

  const where = conditions.length === 0
    ? undefined
    : conditions.length === 1
      ? conditions[0]
      : conditions.reduce((a: any, b: any) => sql`${a} AND ${b}`);

  const countQ = db.select({ count: sql<number>`count(*)` }).from(usersTable);
  const [{ count }] = where ? await countQ.where(where) : await countQ;

  const usersQ = db.select().from(usersTable).orderBy(sql`created_at desc`);
  const users  = where
    ? await usersQ.where(where).limit(limit).offset(offset)
    : await usersQ.limit(limit).offset(offset);

  res.json({ users: users.map(toPublicUser), total: Number(count), page, limit });
});

// ── Get single user ──────────────────────────────────────────────────────────
router.get("/:id", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const callerLevel = getRoleLevel(req.userRole);
  if (req.userId !== id && callerLevel < getRoleLevel("manager")) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  // Prevent seeing a higher-level user (unless admin)
  if (req.userRole !== "admin" && getRoleLevel(user.role) >= callerLevel && req.userId !== id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json(toPublicUser(user));
});

// ── Update own profile ───────────────────────────────────────────────────────
router.patch("/:id", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const callerLevel = getRoleLevel(req.userRole);

  // Must be self, or a manager/admin editing someone below their level
  if (req.userId !== id) {
    if (callerLevel < getRoleLevel("manager")) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    // Fetch target to enforce level hierarchy
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!target) { res.status(404).json({ error: "User not found" }); return; }
    if (req.userRole !== "admin" && getRoleLevel(target.role) >= callerLevel) {
      res.status(403).json({ error: "Cannot modify a user at the same or higher access level" });
      return;
    }
  }

  const { fullName, phone, avatarUrl } = req.body;
  const [user] = await db
    .update(usersTable)
    .set({ fullName, phone, avatarUrl })
    .where(eq(usersTable.id, id))
    .returning();
  res.json(toPublicUser(user));
});

// ── Update role ──────────────────────────────────────────────────────────────
router.patch("/:id/role", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const { role } = req.body;

  const validRoles = ["user", "content_editor", "manager", "admin"];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
    return;
  }

  // Managers cannot assign or remove admin role
  if (req.userRole === "manager" && (role === "admin")) {
    res.status(403).json({ error: "Managers cannot assign the admin role" });
    return;
  }

  // Fetch target to enforce level check
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }

  const callerLevel = getRoleLevel(req.userRole);
  const targetLevel = getRoleLevel(target.role);

  // Caller cannot manage a user at their own level or higher (except admin can manage anyone)
  if (req.userRole !== "admin" && targetLevel >= callerLevel) {
    res.status(403).json({ error: "You can only change roles for users below your access level" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ role: role as any })
    .where(eq(usersTable.id, id))
    .returning();
  res.json(toPublicUser(user));
});

// ── Suspend / reactivate ─────────────────────────────────────────────────────
router.patch("/:id/suspend", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const { suspended } = req.body;

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }

  const callerLevel = getRoleLevel(req.userRole);
  const targetLevel = getRoleLevel(target.role);
  if (req.userRole !== "admin" && targetLevel >= callerLevel) {
    res.status(403).json({ error: "You can only suspend users below your access level" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ status: suspended ? "suspended" : "active" })
    .where(eq(usersTable.id, id))
    .returning();
  res.json(toPublicUser(user));
});

// ── Payout method (admin/manager can edit any user below their level) ─────────
router.patch("/:id/payout-method", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
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

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (req.userRole !== "admin" && getRoleLevel(target.role) >= getRoleLevel(req.userRole)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  await db.execute(
    sql`UPDATE users SET payout_method = ${payoutMethod}, payout_account = ${payoutAccount.trim()}, payout_method_set_at = NOW() WHERE id = ${id}`
  );
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  res.json({ ...toPublicUser(user), payoutMethod, payoutAccount: payoutAccount.trim() });
});

router.get("/:id/payout-method", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);

  // Enforce hierarchy: manager cannot read payout data of an admin
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (req.userRole !== "admin" && getRoleLevel(target.role) >= getRoleLevel(req.userRole)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const rows = await db.execute(
    sql`SELECT payout_method, payout_account, payout_method_set_at FROM users WHERE id = ${id}`
  );
  const r = (rows.rows?.[0] as any) ?? null;
  res.json({
    payoutMethod:    r?.payout_method     ?? null,
    payoutAccount:   r?.payout_account    ?? null,
    payoutMethodSetAt: r?.payout_method_set_at ?? null,
  });
});

export default router;
