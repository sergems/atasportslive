import { Router } from "express";
import bcrypt from "bcrypt";
import { db, usersTable, walletsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  generateTokens,
  generateSessionToken,
  verifyRefreshToken,
  authMiddleware,
  type AuthRequest,
} from "../middlewares/auth";

const router = Router();

function userPayload(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

router.post("/register", async (req, res): Promise<void> => {
  const { email, password, fullName, phone } = req.body;
  if (!email || !password || !fullName) {
    res.status(400).json({ error: "email, password, fullName required" });
    return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({ email, passwordHash, fullName, phone: phone || null, role: "user" })
    .returning();
  await db.insert(walletsTable).values({ userId: user.id });
  const sv = generateSessionToken();
  const tokens = generateTokens(user.id, user.role, sv);
  await db.update(usersTable).set({ refreshToken: tokens.refreshToken, sessionToken: sv }).where(eq(usersTable.id, user.id));
  res.status(201).json({ ...tokens, user: userPayload(user) });
});

router.post("/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "email and password required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (user.status === "suspended") {
    res.status(403).json({ error: "Account suspended" });
    return;
  }

  // Imported users must set their password before they can log in
  if (user.mustSetPassword) {
    res.status(403).json({
      error: "Password setup required",
      reason: "password_reset_required",
      email: user.email,
    });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // Generate a new session token — this invalidates any existing session for this user
  const sv = generateSessionToken();
  const tokens = generateTokens(user.id, user.role, sv);
  await db.update(usersTable).set({ refreshToken: tokens.refreshToken, sessionToken: sv }).where(eq(usersTable.id, user.id));
  res.json({ ...tokens, user: userPayload(user) });
});

// Activated by imported users on their first login
router.post("/set-password", async (req, res): Promise<void> => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    res.status(400).json({ error: "email and newPassword required" });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  if (!user.mustSetPassword) {
    res.status(409).json({ error: "Password already set — please log in normally" });
    return;
  }
  if (user.status === "suspended") {
    res.status(403).json({ error: "Account suspended" });
    return;
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  const sv = generateSessionToken();
  const tokens = generateTokens(user.id, user.role, sv);
  await db
    .update(usersTable)
    .set({ passwordHash, mustSetPassword: false, refreshToken: tokens.refreshToken, sessionToken: sv })
    .where(eq(usersTable.id, user.id));

  // Ensure wallet exists (imported users may not have one yet)
  await db.insert(walletsTable).values({ userId: user.id }).onConflictDoNothing();

  res.json({ ...tokens, user: userPayload(user) });
});

router.post("/refresh", async (req, res): Promise<void> => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: "refreshToken required" });
    return;
  }
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
  if (!user || user.refreshToken !== refreshToken) {
    res.status(401).json({ error: "Token revoked" });
    return;
  }
  // Also verify session token to prevent refresh from a displaced session
  if (payload.sv && user.sessionToken !== payload.sv) {
    res.status(401).json({ error: "Session expired — please log in again" });
    return;
  }
  // Reuse the same session token so the existing session stays alive
  const sv = user.sessionToken || generateSessionToken();
  const tokens = generateTokens(user.id, user.role, sv);
  await db.update(usersTable).set({ refreshToken: tokens.refreshToken, sessionToken: sv }).where(eq(usersTable.id, user.id));
  res.json({ ...tokens, user: userPayload(user) });
});

router.post("/logout", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  await db.update(usersTable).set({ refreshToken: null, sessionToken: null }).where(eq(usersTable.id, req.userId!));
  res.json({ message: "Logged out" });
});

router.get("/me", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(userPayload(user));
});

export default router;
