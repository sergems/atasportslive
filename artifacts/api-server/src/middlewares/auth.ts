import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = (process.env.SESSION_SECRET || process.env.JWT_SECRET) as string;
if (!JWT_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required but was not set.");
}

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
  userEmail?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  const token = authHeader.split(" ")[1];
  let payload: { userId: number; role: string; sv?: string };
  try {
    payload = jwt.verify(token, JWT_SECRET) as { userId: number; role: string; sv?: string };
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  // If the token carries a session version, verify it matches the DB record.
  // Tokens without sv (legacy) are still allowed — they'll be replaced on next login.
  if (payload.sv) {
    db.select({ sessionToken: usersTable.sessionToken })
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1)
      .then(([user]: any[]) => {
        if (!user || user.sessionToken !== payload.sv) {
          res.status(401).json({ error: "Session expired — please log in again" });
          return;
        }
        req.userId = payload.userId;
        req.userRole = payload.role;
        next();
      })
      .catch(() => {
        res.status(500).json({ error: "Internal error" });
      });
  } else {
    req.userId = payload.userId;
    req.userRole = payload.role;
    next();
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.userRole || "")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export function generateSessionToken(): string {
  return randomUUID();
}

export function generateTokens(userId: number, role: string, sessionToken: string) {
  const accessToken = jwt.sign({ userId, role, sv: sessionToken }, JWT_SECRET, { expiresIn: "24h" });
  const refreshToken = jwt.sign({ userId, role, sv: sessionToken, type: "refresh" }, JWT_SECRET, { expiresIn: "30d" });
  return { accessToken, refreshToken };
}

export function verifyRefreshToken(token: string): { userId: number; role: string; sv?: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; role: string; type: string; sv?: string };
    if (payload.type !== "refresh") return null;
    return { userId: payload.userId, role: payload.role, sv: payload.sv };
  } catch {
    return null;
  }
}
