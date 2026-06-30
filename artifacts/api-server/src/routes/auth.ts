import { Router } from "express";
import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
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
    googleLinked: !!user.googleId,
    hasPassword: !!user.passwordHash,
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

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.get("/google/config", (_req, res): void => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID || null });
});

router.post("/google", async (req, res): Promise<void> => {
  const { credential } = req.body as { credential?: string };
  if (!credential) {
    res.status(400).json({ error: "credential required" });
    return;
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    res.status(503).json({ error: "Google Sign-In not configured" });
    return;
  }
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      res.status(400).json({ error: "Invalid Google credential" });
      return;
    }
    const { email, name, picture } = payload;

    // Look up by googleId first, then fall back to email
    let [user] = await db.select().from(usersTable).where(eq(usersTable.googleId, payload.sub!)).limit(1);
    if (!user) {
      [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    }

    if (!user) {
      const [created] = await db
        .insert(usersTable)
        .values({
          email,
          passwordHash: "",
          fullName: name || email.split("@")[0],
          avatarUrl: picture || null,
          googleId: payload.sub,
          role: "user",
        })
        .returning();
      user = created;
      await db.insert(walletsTable).values({ userId: user.id });
    } else if (!user.googleId) {
      // Existing email-only user — auto-link their Google account
      await db.update(usersTable).set({ googleId: payload.sub }).where(eq(usersTable.id, user.id));
      user = { ...user, googleId: payload.sub! };
    }

    if (user.status === "suspended") {
      res.status(403).json({ error: "Account suspended" });
      return;
    }

    const sv = generateSessionToken();
    const tokens = generateTokens(user.id, user.role, sv);
    await db
      .update(usersTable)
      .set({ refreshToken: tokens.refreshToken, sessionToken: sv })
      .where(eq(usersTable.id, user.id));

    res.json({ ...tokens, user: userPayload(user) });
  } catch {
    res.status(401).json({ error: "Invalid Google credential" });
  }
});

router.post("/google/link", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { credential } = req.body as { credential?: string };
  if (!credential) { res.status(400).json({ error: "credential required" }); return; }
  if (!process.env.GOOGLE_CLIENT_ID) { res.status(503).json({ error: "Google Sign-In not configured" }); return; }
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.sub) { res.status(400).json({ error: "Invalid Google credential" }); return; }

    // Ensure googleId not already claimed by another account
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.googleId, payload.sub)).limit(1);
    if (existing && existing.id !== req.userId) {
      res.status(409).json({ error: "This Google account is already linked to another user" });
      return;
    }

    await db.update(usersTable).set({ googleId: payload.sub }).where(eq(usersTable.id, req.userId!));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    res.json(userPayload(user));
  } catch {
    res.status(401).json({ error: "Invalid Google credential" });
  }
});

router.delete("/google/link", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (!user.passwordHash) {
    res.status(400).json({ error: "Set a password before unlinking Google — otherwise you cannot sign in." });
    return;
  }
  await db.update(usersTable).set({ googleId: null }).where(eq(usersTable.id, req.userId!));
  res.json(userPayload({ ...user, googleId: null }));
});

router.patch("/profile", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { fullName, phone } = req.body as { fullName?: string; phone?: string };
  if (!fullName?.trim()) { res.status(400).json({ error: "fullName required" }); return; }
  await db.update(usersTable).set({ fullName: fullName.trim(), phone: phone?.trim() || null }).where(eq(usersTable.id, req.userId!));
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  res.json(userPayload(user));
});

router.patch("/password", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!newPassword || newPassword.length < 6) { res.status(400).json({ error: "New password must be at least 6 characters" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.passwordHash) {
    if (!currentPassword) { res.status(400).json({ error: "Current password required" }); return; }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Current password is incorrect" }); return; }
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash, mustSetPassword: false }).where(eq(usersTable.id, req.userId!));
  res.json({ message: "Password updated" });
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
