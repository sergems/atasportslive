import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { sendMail } from "../lib/mailer";

const router = Router();

// Keys safe to expose publicly (no credentials).
// Must include every key read by live-channel.tsx so unauthenticated viewers
// can see live-stream state, pricing, thumbnails, and player details.
const PUBLIC_SETTING_KEYS = new Set([
  // ── Channel 1 ───────────────────────────────────────────────────────────
  "cf_is_live", "cf_playback_id", "cf_hls_url", "cf_stream_db_id", "cf_title", "cf_price",
  "cf_is_free", "cf_thumbnail_url", "cf_sport",
  "cf_player_a", "cf_player_b", "cf_player_a_country", "cf_player_b_country",
  "yt_is_live", "yt_video_id", "yt_stream_db_id", "yt_title", "yt_price",
  "yt_is_free", "yt_thumbnail_url", "yt_sport",
  "yt_player_a", "yt_player_b", "yt_player_a_country", "yt_player_b_country",
  "liveStreamUrl",
  // ── Channel 2 ───────────────────────────────────────────────────────────
  "ch2_page_enabled",
  "ch2_cf_is_live", "ch2_cf_playback_id", "ch2_cf_hls_url", "ch2_cf_stream_db_id", "ch2_cf_title", "ch2_cf_price",
  "ch2_cf_is_free", "ch2_cf_thumbnail_url", "ch2_cf_sport",
  "ch2_cf_player_a", "ch2_cf_player_b", "ch2_cf_player_a_country", "ch2_cf_player_b_country",
  "ch2_yt_is_live", "ch2_yt_video_id", "ch2_yt_stream_db_id", "ch2_yt_title", "ch2_yt_price",
  "ch2_yt_is_free", "ch2_yt_thumbnail_url", "ch2_yt_sport",
  "ch2_yt_player_a", "ch2_yt_player_b", "ch2_yt_player_a_country", "ch2_yt_player_b_country",
  // ── Channel 3 ───────────────────────────────────────────────────────────
  "ch3_page_enabled",
  "ch3_cf_is_live", "ch3_cf_playback_id", "ch3_cf_hls_url", "ch3_cf_stream_db_id", "ch3_cf_title", "ch3_cf_price",
  "ch3_cf_is_free", "ch3_cf_thumbnail_url", "ch3_cf_sport",
  "ch3_cf_player_a", "ch3_cf_player_b", "ch3_cf_player_a_country", "ch3_cf_player_b_country",
  "ch3_yt_is_live", "ch3_yt_video_id", "ch3_yt_stream_db_id", "ch3_yt_title", "ch3_yt_price",
  "ch3_yt_is_free", "ch3_yt_thumbnail_url", "ch3_yt_sport",
  "ch3_yt_player_a", "ch3_yt_player_b", "ch3_yt_player_a_country", "ch3_yt_player_b_country",
  // ── Subscription pricing ─────────────────────────────────────────────────
  "price_daily", "price_weekly", "price_monthly", "price_yearly",
  // ── Ad slots (displayed to all visitors on /upcoming and /fixtures) ───────
  "ads_hide_on_mobile",
  "ad_slot_left_1_image",  "ad_slot_left_1_link",  "ad_slot_left_1_enabled",
  "ad_slot_left_2_image",  "ad_slot_left_2_link",  "ad_slot_left_2_enabled",
  "ad_slot_left_3_image",  "ad_slot_left_3_link",  "ad_slot_left_3_enabled",
  "ad_slot_right_1_image", "ad_slot_right_1_link", "ad_slot_right_1_enabled",
  "ad_slot_right_2_image", "ad_slot_right_2_link", "ad_slot_right_2_enabled",
  "ad_slot_right_3_image", "ad_slot_right_3_link", "ad_slot_right_3_enabled",
]);

// Public settings — only non-sensitive keys, no auth required
router.get("/public", async (_req, res): Promise<void> => {
  const rows = await db.execute(sql`SELECT key, value FROM settings`);
  const obj: Record<string, string> = {};
  for (const row of rows.rows as { key: string; value: string }[]) {
    if (PUBLIC_SETTING_KEYS.has(row.key)) obj[row.key] = row.value ?? "";
  }
  res.json(obj);
});

// Full settings — admin/manager only (contains SMTP, payment credentials)
router.get("/", authMiddleware, requireRole("admin", "manager"), async (_req: AuthRequest, res): Promise<void> => {
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

const YT_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

const CF_STREAM_HOST = "customer-g6v4ltgbn9y6fl7a.cloudflarestream.com";

/** Cloudflare's public lifecycle endpoint tells us whether a live input is broadcasting. */
function cfLifecycleUrl(uid?: string, hlsUrl?: string): string | null {
  if (uid && hlsUrl) {
    try {
      const u = new URL(hlsUrl);
      return `https://${u.host}/${uid}/lifecycle`;
    } catch { /* fall through to the configured host */ }
  }
  return uid ? `https://${CF_STREAM_HOST}/${uid}/lifecycle` : null;
}

async function cfInputIsLive(uid?: string, hlsUrl?: string): Promise<boolean> {
  const url = cfLifecycleUrl(uid, hlsUrl);
  if (!url) return false;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return false;
    const data = (await res.json()) as { live?: boolean };
    return data.live === true;
  } catch {
    return false;
  }
}

// Sync the Cloudflare default stream record in the streams table so existing
// stream-access infrastructure handles the paywall automatically.
// All writes are wrapped in a single transaction so mutual-exclusion is atomic.
router.post("/sync-cf", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  try {
    await db.transaction(async (tx: any) => {
      const rows = await tx.execute(sql`SELECT key, value FROM settings WHERE key LIKE 'cf_%' OR key = 'yt_stream_db_id'`);
      const s: Record<string, string> = {};
      for (const row of rows.rows as { key: string; value: string }[]) s[row.key] = row.value ?? "";

      const isLive = s.cf_is_live === "true";
      const price  = s.cf_price || "1.50";
      const title  = s.cf_title || "ATA Live Stream";
      const status = isLive ? "live" : "upcoming";

      // Mutual exclusion: going live → forcibly disable YouTube in the same tx
      if (isLive) {
        await tx.execute(
          sql`INSERT INTO settings (key, value, updated_at) VALUES ('yt_is_live', 'false', NOW())
              ON CONFLICT (key) DO UPDATE SET value = 'false', updated_at = NOW()`
        );
        const ytDbId = s.yt_stream_db_id ? Number(s.yt_stream_db_id) : null;
        if (ytDbId) {
          await tx.execute(
            sql`UPDATE streams SET status = 'upcoming'::stream_status, updated_at = NOW() WHERE id = ${ytDbId}`
          );
        }
      }

      const existing = await tx.execute(
        sql`SELECT id FROM streams WHERE stream_key = '__cf_default__' ORDER BY id LIMIT 1`
      );
      const existingRow = (existing.rows as { id: number }[])[0];
      let streamId: number;

      if (existingRow) {
        await tx.execute(
          sql`UPDATE streams SET title = ${title}, status = ${status}::stream_status, access_price = ${price}, updated_at = NOW() WHERE id = ${existingRow.id}`
        );
        streamId = existingRow.id;
      } else {
        const inserted = await tx.execute(
          sql`INSERT INTO streams (title, sport, status, start_time, access_price, stream_key, viewer_count, updated_at)
              VALUES (${title}, 'other'::sport_type, ${status}::stream_status, NOW(), ${price}, '__cf_default__', 0, NOW())
              RETURNING id`
        );
        streamId = (inserted.rows as { id: number }[])[0].id;
      }

      await tx.execute(
        sql`INSERT INTO settings (key, value, updated_at) VALUES ('cf_stream_db_id', ${streamId.toString()}, NOW())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`
      );

      res.json({ ok: true, streamId });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "sync-cf failed" });
  }
});

// Sync the YouTube default stream record — mirrors sync-cf logic.
router.post("/sync-yt", authMiddleware, requireRole("admin", "manager"), async (req: AuthRequest, res): Promise<void> => {
  try {
    await db.transaction(async (tx: any) => {
      const rows = await tx.execute(sql`SELECT key, value FROM settings WHERE key LIKE 'yt_%' OR key = 'cf_stream_db_id'`);
      const s: Record<string, string> = {};
      for (const row of rows.rows as { key: string; value: string }[]) s[row.key] = row.value ?? "";

      const isLive   = s.yt_is_live === "true";
      const videoId  = s.yt_video_id ?? "";
      const price    = s.yt_price || "1.50";
      const title    = s.yt_title || "ATA Live Stream";
      const status   = isLive ? "live" : "upcoming";

      // Reject going live without a valid video ID
      if (isLive && !YT_ID_RE.test(videoId)) {
        res.status(400).json({ error: "yt_video_id must be a valid 11-character YouTube video ID" });
        return;
      }

      // Mutual exclusion: going live → forcibly disable Cloudflare in the same tx
      if (isLive) {
        await tx.execute(
          sql`INSERT INTO settings (key, value, updated_at) VALUES ('cf_is_live', 'false', NOW())
              ON CONFLICT (key) DO UPDATE SET value = 'false', updated_at = NOW()`
        );
        const cfDbId = s.cf_stream_db_id ? Number(s.cf_stream_db_id) : null;
        if (cfDbId) {
          await tx.execute(
            sql`UPDATE streams SET status = 'upcoming'::stream_status, updated_at = NOW() WHERE id = ${cfDbId}`
          );
        }
      }

      const existing = await tx.execute(
        sql`SELECT id FROM streams WHERE stream_key = '__yt_default__' ORDER BY id LIMIT 1`
      );
      const existingRow = (existing.rows as { id: number }[])[0];
      let streamId: number;

      if (existingRow) {
        await tx.execute(
          sql`UPDATE streams SET title = ${title}, status = ${status}::stream_status, access_price = ${price}, updated_at = NOW() WHERE id = ${existingRow.id}`
        );
        streamId = existingRow.id;
      } else {
        const inserted = await tx.execute(
          sql`INSERT INTO streams (title, sport, status, start_time, access_price, stream_key, viewer_count, updated_at)
              VALUES (${title}, 'other'::sport_type, ${status}::stream_status, NOW(), ${price}, '__yt_default__', 0, NOW())
              RETURNING id`
        );
        streamId = (inserted.rows as { id: number }[])[0].id;
      }

      await tx.execute(
        sql`INSERT INTO settings (key, value, updated_at) VALUES ('yt_stream_db_id', ${streamId.toString()}, NOW())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`
      );

      res.json({ ok: true, streamId });
    });
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ error: err.message || "sync-yt failed" });
  }
});

// Auto-probe Cloudflare Stream's lifecycle endpoint to detect when a live input ends.
// Called by the frontend periodically while cf_is_live=true.
// When the input is idle we flip cf_is_live=false and update the companion stream
// record so the paywall disappears automatically.
router.post("/cf-probe", async (_req, res): Promise<void> => {
  try {
    const rows = await db.execute(sql`SELECT key, value FROM settings WHERE key LIKE 'cf_%'`);
    const s: Record<string, string> = {};
    for (const row of rows.rows as { key: string; value: string }[]) s[row.key] = row.value ?? "";

    const playbackId = s.cf_playback_id;
    const isLive     = s.cf_is_live === "true";

    // Nothing to probe if Cloudflare is already marked offline
    if (!isLive || !playbackId) { res.json({ live: false, changed: false }); return; }

    // The lifecycle endpoint is public and reports "live" only while broadcasting.
    const online = await cfInputIsLive(playbackId, s.cf_hls_url);
    if (online) { res.json({ live: true, changed: false }); return; }

    // Stream has ended — flip the flag
    await db.execute(
      sql`INSERT INTO settings (key, value, updated_at) VALUES ('cf_is_live', 'false', NOW())
          ON CONFLICT (key) DO UPDATE SET value = 'false', updated_at = NOW()`
    );

    // Also update the companion stream record if it exists
    const dbId = s.cf_stream_db_id ? Number(s.cf_stream_db_id) : null;
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

// ── Channel 2 & 3 helpers ─────────────────────────────────────────────────────

async function syncChannelCf(channel: 2 | 3, res: any): Promise<void> {
  const p        = `ch${channel}_cf`;
  const ytLiveK  = `ch${channel}_yt_is_live`;
  const ytDbIdK  = `ch${channel}_yt_stream_db_id`;
  const streamKey = `__ch${channel}_cf_default__`;
  const dbIdKey  = `ch${channel}_cf_stream_db_id`;
  try {
    await db.transaction(async (tx: any) => {
      const rows = await tx.execute(sql`SELECT key, value FROM settings WHERE key LIKE ${`ch${channel}_%`}`);
      const s: Record<string, string> = {};
      for (const row of rows.rows as { key: string; value: string }[]) s[row.key] = row.value ?? "";
      const isLive = s[`${p}_is_live`] === "true";
      const price  = s[`${p}_price`] || "1.50";
      const title  = s[`${p}_title`] || `ATA Live Stream ${channel}`;
      const status = isLive ? "live" : "upcoming";
      if (isLive) {
        await tx.execute(sql`INSERT INTO settings (key, value, updated_at) VALUES (${ytLiveK}, 'false', NOW()) ON CONFLICT (key) DO UPDATE SET value = 'false', updated_at = NOW()`);
        const ytDbId = s[ytDbIdK] ? Number(s[ytDbIdK]) : null;
        if (ytDbId) await tx.execute(sql`UPDATE streams SET status = 'upcoming'::stream_status, updated_at = NOW() WHERE id = ${ytDbId}`);
      }
      const existing = await tx.execute(sql`SELECT id FROM streams WHERE stream_key = ${streamKey} ORDER BY id LIMIT 1`);
      const existingRow = (existing.rows as { id: number }[])[0];
      let streamId: number;
      if (existingRow) {
        await tx.execute(sql`UPDATE streams SET title = ${title}, status = ${status}::stream_status, access_price = ${price}, updated_at = NOW() WHERE id = ${existingRow.id}`);
        streamId = existingRow.id;
      } else {
        const inserted = await tx.execute(sql`INSERT INTO streams (title, sport, status, start_time, access_price, stream_key, viewer_count, updated_at) VALUES (${title}, 'other'::sport_type, ${status}::stream_status, NOW(), ${price}, ${streamKey}, 0, NOW()) RETURNING id`);
        streamId = (inserted.rows as { id: number }[])[0].id;
      }
      await tx.execute(sql`INSERT INTO settings (key, value, updated_at) VALUES (${dbIdKey}, ${streamId.toString()}, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`);
      if (!res.headersSent) res.json({ ok: true, streamId });
    });
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ error: err.message || `sync-ch${channel}-cf failed` });
  }
}

async function syncChannelYt(channel: 2 | 3, res: any): Promise<void> {
  const p         = `ch${channel}_yt`;
  const cfLiveK  = `ch${channel}_cf_is_live`;
  const cfDbIdK  = `ch${channel}_cf_stream_db_id`;
  const streamKey = `__ch${channel}_yt_default__`;
  const dbIdKey   = `ch${channel}_yt_stream_db_id`;
  try {
    await db.transaction(async (tx: any) => {
      const rows = await tx.execute(sql`SELECT key, value FROM settings WHERE key LIKE ${`ch${channel}_%`}`);
      const s: Record<string, string> = {};
      for (const row of rows.rows as { key: string; value: string }[]) s[row.key] = row.value ?? "";
      const isLive  = s[`${p}_is_live`] === "true";
      const videoId = s[`${p}_video_id`] ?? "";
      const price   = s[`${p}_price`] || "1.50";
      const title   = s[`${p}_title`] || `ATA Live Stream ${channel}`;
      const status  = isLive ? "live" : "upcoming";
      if (isLive && !YT_ID_RE.test(videoId)) {
        res.status(400).json({ error: "YouTube video ID must be a valid 11-character ID" });
        return;
      }
      if (isLive) {
        await tx.execute(sql`INSERT INTO settings (key, value, updated_at) VALUES (${cfLiveK}, 'false', NOW()) ON CONFLICT (key) DO UPDATE SET value = 'false', updated_at = NOW()`);
        const cfDbId = s[cfDbIdK] ? Number(s[cfDbIdK]) : null;
        if (cfDbId) await tx.execute(sql`UPDATE streams SET status = 'upcoming'::stream_status, updated_at = NOW() WHERE id = ${cfDbId}`);
      }
      const existing = await tx.execute(sql`SELECT id FROM streams WHERE stream_key = ${streamKey} ORDER BY id LIMIT 1`);
      const existingRow = (existing.rows as { id: number }[])[0];
      let streamId: number;
      if (existingRow) {
        await tx.execute(sql`UPDATE streams SET title = ${title}, status = ${status}::stream_status, access_price = ${price}, updated_at = NOW() WHERE id = ${existingRow.id}`);
        streamId = existingRow.id;
      } else {
        const inserted = await tx.execute(sql`INSERT INTO streams (title, sport, status, start_time, access_price, stream_key, viewer_count, updated_at) VALUES (${title}, 'other'::sport_type, ${status}::stream_status, NOW(), ${price}, ${streamKey}, 0, NOW()) RETURNING id`);
        streamId = (inserted.rows as { id: number }[])[0].id;
      }
      await tx.execute(sql`INSERT INTO settings (key, value, updated_at) VALUES (${dbIdKey}, ${streamId.toString()}, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`);
      if (!res.headersSent) res.json({ ok: true, streamId });
    });
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ error: err.message || `sync-ch${channel}-yt failed` });
  }
}

async function probeChannelCf(channel: 2 | 3, res: any): Promise<void> {
  try {
    const rows = await db.execute(sql`SELECT key, value FROM settings WHERE key LIKE ${`ch${channel}_cf_%`}`);
    const s: Record<string, string> = {};
    for (const row of rows.rows as { key: string; value: string }[]) s[row.key] = row.value ?? "";
    const playbackId = s[`ch${channel}_cf_playback_id`];
    const isLive     = s[`ch${channel}_cf_is_live`] === "true";
    if (!isLive || !playbackId) { res.json({ live: false, changed: false }); return; }
    const online = await cfInputIsLive(playbackId, s[`ch${channel}_cf_hls_url`]);
    if (online) { res.json({ live: true, changed: false }); return; }
    const liveKey = `ch${channel}_cf_is_live`;
    await db.execute(sql`INSERT INTO settings (key, value, updated_at) VALUES (${liveKey}, 'false', NOW()) ON CONFLICT (key) DO UPDATE SET value = 'false', updated_at = NOW()`);
    const dbIdKey = `ch${channel}_cf_stream_db_id`;
    const dbId = s[dbIdKey] ? Number(s[dbIdKey]) : null;
    if (dbId) await db.execute(sql`UPDATE streams SET status = 'upcoming'::stream_status, updated_at = NOW() WHERE id = ${dbId}`);
    res.json({ live: false, changed: true });
  } catch (err) {
    res.status(500).json({ error: "Probe failed" });
  }
}

router.post("/sync-ch2-cf", authMiddleware, requireRole("admin", "manager"), async (_req, res): Promise<void> => { await syncChannelCf(2, res); });
router.post("/sync-ch2-yt",  authMiddleware, requireRole("admin", "manager"), async (_req, res): Promise<void> => { await syncChannelYt(2, res);  });
router.post("/ch2-cf-probe", async (_req, res): Promise<void> => { await probeChannelCf(2, res); });
router.post("/sync-ch3-cf", authMiddleware, requireRole("admin", "manager"), async (_req, res): Promise<void> => { await syncChannelCf(3, res); });
router.post("/sync-ch3-yt",  authMiddleware, requireRole("admin", "manager"), async (_req, res): Promise<void> => { await syncChannelYt(3, res);  });
router.post("/ch3-cf-probe", async (_req, res): Promise<void> => { await probeChannelCf(3, res); });

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
