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

// Keys that only admin may write (payment gateways, SMTP, DB backup)
const ADMIN_ONLY_SETTING_PREFIXES = ["smtp_", "pesapal_", "pawapay_"];

router.put("/", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const updates = req.body as Record<string, string>;
  if (!updates || typeof updates !== "object") {
    res.status(400).json({ error: "Body must be an object of key/value pairs" });
    return;
  }
  for (const [key, value] of Object.entries(updates)) {
    // Block managers from writing restricted keys
    if (req.userRole !== "admin" && ADMIN_ONLY_SETTING_PREFIXES.some(p => key.startsWith(p))) {
      continue; // silently skip — frontend never sends these for managers
    }
    await db.execute(
      sql`INSERT INTO settings (key, value, updated_at) VALUES (${key}, ${value}, NOW())
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`
    );
  }
  res.json({ ok: true });
});

// Sync the Mux default stream record in the streams table so existing
// stream-access infrastructure handles the paywall automatically.
router.post("/sync-mux", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  const rows = await db.execute(sql`SELECT key, value FROM settings WHERE key LIKE 'mux_%'`);
  const s: Record<string, string> = {};
  for (const row of rows.rows as { key: string; value: string }[]) s[row.key] = row.value ?? "";

  const isLive = s.mux_is_live === "true";
  const price = s.mux_price || "1.50";
  const title = s.mux_title || "ATA Live Stream";
  const status = isLive ? "live" : "upcoming";

  const existing = await db.execute(
    sql`SELECT id FROM streams WHERE stream_key = '__mux_default__' ORDER BY id LIMIT 1`
  );
  const existingRow = (existing.rows as { id: number }[])[0];

  let streamId: number;

  if (existingRow) {
    await db.execute(
      sql`UPDATE streams SET title = ${title}, status = ${status}::stream_status, access_price = ${price}, updated_at = NOW() WHERE id = ${existingRow.id}`
    );
    streamId = existingRow.id;
  } else {
    const inserted = await db.execute(
      sql`INSERT INTO streams (title, sport, status, start_time, access_price, stream_key, viewer_count, updated_at)
          VALUES (${title}, 'other'::sport_type, ${status}::stream_status, NOW(), ${price}, '__mux_default__', 0, NOW())
          RETURNING id`
    );
    streamId = (inserted.rows as { id: number }[])[0].id;
  }

  await db.execute(
    sql`INSERT INTO settings (key, value, updated_at) VALUES ('mux_stream_db_id', ${streamId.toString()}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`
  );

  res.json({ ok: true, streamId });
});

// Auto-probe the Mux HLS manifest to detect when a live stream ends.
// Called by the frontend periodically while mux_is_live=true.
// If Mux returns 4xx the stream has ended — we flip mux_is_live=false and
// update the companion stream record so the paywall disappears automatically.
router.post("/mux-probe", async (_req, res): Promise<void> => {
  try {
    const rows = await db.execute(sql`SELECT key, value FROM settings WHERE key LIKE 'mux_%'`);
    const s: Record<string, string> = {};
    for (const row of rows.rows as { key: string; value: string }[]) s[row.key] = row.value ?? "";

    const playbackId = s.mux_playback_id;
    const isLive     = s.mux_is_live === "true";

    // Nothing to probe if Mux is already marked offline
    if (!isLive || !playbackId) { res.json({ live: false, changed: false }); return; }

    // Probe the HLS manifest — no auth required for public playback IDs
    let muxLive = true;
    try {
      const probe = await fetch(`https://stream.mux.com/${playbackId}.m3u8`, { method: "HEAD" });
      muxLive = probe.ok; // 4xx / 5xx → stream is idle/ended
    } catch {
      muxLive = false; // network error — treat as offline
    }

    if (muxLive) { res.json({ live: true, changed: false }); return; }

    // Stream has ended — flip the flag
    await db.execute(
      sql`INSERT INTO settings (key, value, updated_at) VALUES ('mux_is_live', 'false', NOW())
          ON CONFLICT (key) DO UPDATE SET value = 'false', updated_at = NOW()`
    );

    // Also update the companion stream record if it exists
    const dbId = s.mux_stream_db_id ? Number(s.mux_stream_db_id) : null;
    if (dbId) {
      await db.execute(
        sql`UPDATE streams SET status = 'upcoming'::stream_status, updated_at = NOW() WHERE id = ${dbId}`
      );
    }

    res.json({ live: false, changed: true });
  } catch (err) {
    res.status(500).json({ error: "Probe failed" });
  }
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
