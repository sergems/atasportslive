import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { sendMail } from "../lib/mailer";

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

// Send a test email to the logged-in admin using saved SMTP settings
router.post("/test-email", authMiddleware, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const rows = await db.execute(sql`SELECT key, value FROM settings WHERE key LIKE 'smtp_%'`);
  const s: Record<string, string> = {};
  for (const row of rows.rows as { key: string; value: string }[]) s[row.key] = row.value ?? "";
  if (!s.smtp_host || !s.smtp_user || !s.smtp_pass) {
    res.status(400).json({ error: "SMTP not configured. Save SMTP settings first." });
    return;
  }
  const adminId = req.userId;
  if (!adminId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const adminRows = await db.execute(sql`SELECT email FROM users WHERE id = ${adminId} LIMIT 1`);
  const adminUser = (adminRows.rows as { email: string }[])[0];
  const adminEmail = adminUser?.email;
  if (!adminEmail) { res.status(400).json({ error: "Could not determine admin email" }); return; }
  const sent = await sendMail({
    to: adminEmail,
    subject: "ATA Sports Live — SMTP Test",
    html: `<div style="font-family:sans-serif;padding:24px;background:#0f1623;color:#e2e8f0;border-radius:8px">
      <h2 style="color:#14b8a6">SMTP Test Successful ✓</h2>
      <p>Your SMTP configuration is working correctly.</p>
      <p style="color:#64748b;font-size:12px">Sent via ${s.smtp_host}:${s.smtp_port || 587}</p>
    </div>`,
  });
  if (sent) res.json({ ok: true });
  else res.status(500).json({ error: "Failed to send email. Check SMTP credentials." });
});

export default router;
