-- Comment moderation: hidden comments + temporary commenting blocks.
-- Run on the LIVE database on Linode (no restart required):
--   cd /opt/ata && docker compose exec -T db psql -U ata_user -d ata_db < this-file.sql

ALTER TABLE public.stream_comments
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_by INTEGER REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hide_reason TEXT;

CREATE TABLE IF NOT EXISTS public.comment_bans (
  user_id INTEGER PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  banned_until TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_by INTEGER REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comment_bans_until_idx ON public.comment_bans(banned_until);

-- Verify:
-- \d public.stream_comments
-- \d public.comment_bans
