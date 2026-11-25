-- Replace Mux with Cloudflare Stream.
-- Safe to re-run: renames are no-ops the second time, settings use ON CONFLICT.

-- 1. Rename all Mux setting keys to cf_* (channel prefixes are preserved).
UPDATE settings SET key = replace(key, 'mux_', 'cf_'), updated_at = NOW()
WHERE key LIKE 'mux_%' OR key LIKE 'ch2_mux_%' OR key LIKE 'ch3_mux_%';

-- 2. Point the playback keys at the new Cloudflare Stream Live Input UIDs.
UPDATE settings SET value = '943a0b1a8184331cdb4ac9a7aef6f07e', updated_at = NOW()
WHERE key = 'cf_playback_id';
UPDATE settings SET value = '02672b2c4ecd1ec8dccf90ba9caac0f8', updated_at = NOW()
WHERE key = 'ch2_cf_playback_id';
UPDATE settings SET value = '57b7175304c4a9be02ad6bb46783c97c', updated_at = NOW()
WHERE key = 'ch3_cf_playback_id';

-- 3. Store unsigned HLS manifest URLs (clients fall back to deriving these from the UID).
INSERT INTO settings (key, value, updated_at) VALUES
  ('cf_hls_url',   'https://customer-g6v4ltgbn9y6fl7a.cloudflarestream.com/943a0b1a8184331cdb4ac9a7aef6f07e/manifest/video.m3u8', NOW()),
  ('ch2_cf_hls_url','https://customer-g6v4ltgbn9y6fl7a.cloudflarestream.com/02672b2c4ecd1ec8dccf90ba9caac0f8/manifest/video.m3u8', NOW()),
  ('ch3_cf_hls_url','https://customer-g6v4ltgbn9y6fl7a.cloudflarestream.com/57b7175304c4a9be02ad6bb46783c97c/manifest/video.m3u8', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- 4. Rename the virtual paywall-anchor stream keys.
UPDATE streams SET stream_key = '__cf_default__', updated_at = NOW()
WHERE stream_key = '__mux_default__';
UPDATE streams SET stream_key = '__ch2_cf_default__', updated_at = NOW()
WHERE stream_key = '__ch2_mux_default__';
UPDATE streams SET stream_key = '__ch3_cf_default__', updated_at = NOW()
WHERE stream_key = '__ch3_mux_default__';
