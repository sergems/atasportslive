import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/", async (_req, res): Promise<void> => {
  const rows = await db.execute(sql`SELECT key, value FROM settings`);
  const obj: Record<string, string> = {};
  for (const row of rows.rows as { key: string; value: string }[]) {
    obj[row.key] = row.value ?? "";
  }
  res.json(obj);
});

router.put("/", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const updates = req.body as Record<string, string>;
  if (!updates || typeof updates !== "object") {
    res.status(400).json({ error: "Body must be an object of key/value pairs" });
    return;
  }
  for (const [key, value] of Object.entries(updates)) {
    await db.execute(
      sql`INSERT INTO settings (key, value, updated_at) VALUES (${key}, ${value}, NOW())
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`
    );
  }
  res.json({ ok: true });
});

export default router;
