import { Router } from "express";
import bcrypt from "bcrypt";
import { db, usersTable, walletsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  generateTokens,
  verifyRefreshToken,
  authMiddleware,
  type AuthRequest,
} from "../middlewares/auth";

const router = Router();

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
  const tokens = generateTokens(user.id, user.role);
  await db.update(usersTable).set({ refreshToken: tokens.refreshToken }).where(eq(usersTable.id, user.id));
  res.status(201).json({
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    },
  });
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
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const tokens = generateTokens(user.id, user.role);
  await db.update(usersTable).set({ refreshToken: tokens.refreshToken }).where(eq(usersTable.id, user.id));
  res.json({
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    },
  });
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
  const tokens = generateTokens(user.id, user.role);
  await db.update(usersTable).set({ refreshToken: tokens.refreshToken }).where(eq(usersTable.id, user.id));
  res.json({
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    },
  });
});

router.post("/logout", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  await db.update(usersTable).set({ refreshToken: null }).where(eq(usersTable.id, req.userId!));
  res.json({ message: "Logged out" });
});

router.get("/me", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  });
});

export default router;
