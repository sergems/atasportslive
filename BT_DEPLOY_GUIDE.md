# ATA Platform — Update & Full DB Wipe Deployment Guide

**Server:** `45.79.219.243`  
**App directory:** `/opt/ata`

> ⚠️ This guide **completely wipes and rebuilds the production database** from `bt.sql`.  
> All existing server-side data (users, bets, wallets, payments) will be **permanently deleted** with no recovery unless you complete Step 3.

---

## Step 1 — Commit and push the code to GitHub (on Replit)

> ⚠️ **Privacy note:** `bt.sql` contains real user PII and payment credentials. Make sure your GitHub repository is set to **private** before pushing.

Run this in the **Replit Shell** tab:

```bash
git add -A
git commit -m "Update: bug fixes and db refresh"
git push origin main
```

Wait for the push to finish before touching the server. `bt.sql` travels with this commit.

---

## Step 2 — SSH into the server

```bash
ssh root@45.79.219.243
```

---

## Step 3 — Back up the existing database (do not skip)

```bash
cd /opt/ata
./deploy/backup.sh
ls -lh /opt/ata/backups/
```

You should see a new `.sql.gz` file with today's date. If the script fails, run manually:

```bash
docker compose exec db pg_dump -U ata_user ata_db | gzip > /opt/ata/backups/manual-backup-$(date +%Y%m%d-%H%M%S).sql.gz
```

**Do not proceed without a confirmed backup file.**

---

## Step 4 — Pull the latest code

```bash
cd /opt/ata
git pull origin main
```

Confirm `bt.sql` arrived and is the right size:

```bash
wc -l /opt/ata/bt.sql
# Should print 12183
```

---

## Step 5 — Stop all running services

```bash
docker compose down
```

Confirm everything stopped:

```bash
docker compose ps
# Should show nothing
```

---

## Step 6 — Start only the database container

```bash
docker compose up -d db
```

Wait until it shows `(healthy)` — usually 15–30 seconds:

```bash
watch docker compose ps
# Press Ctrl+C once you see: ata-db-1   Up (healthy)
```

---

## Step 7 — Completely wipe the database

This drops the entire `public` schema — all tables, indexes, sequences, **and custom enum types** — then recreates it clean. This is necessary because `bt.sql` defines its own enums and a leftover type will cause the import to fail.

```bash
docker compose exec db psql -U ata_user -d ata_db -c "
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO ata_user;
GRANT ALL ON SCHEMA public TO public;
"
```

Verify it's empty (should return zero rows):

```bash
docker compose exec db psql -U ata_user -d ata_db \
  -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
```

---

## Step 8 — Import bt.sql

`bt.sql` has two proprietary wrapper lines (line 5 and line 12183) that must be stripped before PostgreSQL can read it. The command below does that automatically:

```bash
sed -e '5d' -e '12183d' /opt/ata/bt.sql | docker compose exec -T db psql -U ata_user -d ata_db
```

The import prints many lines of SQL output. The last few should look like:

```
...
ALTER TABLE
ALTER TABLE
REVOKE
GRANT
```

Verify all tables were created (expect 19 tables):

```bash
docker compose exec db psql -U ata_user -d ata_db \
  -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
```

Expected tables: `announcements, audit_logs, bets, bonus_transactions, games, hero_slides, highlights, notifications, platform_subscriptions, promotion_terms_acceptance, promotions, settings, stream_access, stream_comments, streams, transactions, users, vouchers, wallets`

**If any table is missing, stop here — do not continue until the list is complete.**

---

## Step 9 — Rebuild the Docker images

This recompiles the API server and rebuilds the React frontend with all the latest code changes. **Takes 3–6 minutes.**

```bash
docker compose build
```

If the build fails, try without cache:

```bash
docker compose build --no-cache
```

---

## Step 10 — Copy new uploaded images into the Docker volume (non-destructive)

This adds any image files from the repo that are **not already on the server**. It will never overwrite or delete images that were uploaded directly to the production server. The `-n` flag (no-clobber) is what makes this safe.

```bash
docker run --rm \
  -v ata_uploads:/target \
  -v /opt/ata/artifacts/api-server/uploads:/source:ro \
  alpine sh -c "cp -rn /source/. /target/ && echo 'Done' && ls /target | wc -l"
```

You should see `Done` followed by the total image count in the volume. If you had, say, 40 images on the server and the repo has 5 new ones, the count will go up by 5 — existing files are untouched.

---

## Step 11 — Start all services

```bash
docker compose up -d
```

The `migrate` service runs automatically first. Since `bt.sql` already matches the current schema it will detect no changes and exit cleanly. Then `api` and `nginx` start.

Watch the logs to confirm a clean startup:

```bash
docker compose logs -f --tail=60
```

Press `Ctrl+C` once you see lines like:

```
ata-api-1   | {"level":30,"msg":"ATA Platform server listening","port":8080}
ata-api-1   | {"level":30,"msg":"Bonus expiry cron started"}
```

Check all containers are running:

```bash
docker compose ps
```

Expected output:

```
NAME          STATUS            PORTS
ata-db-1      Up (healthy)
ata-api-1     Up
ata-nginx-1   Up                0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

---

## Step 12 — Verify the deployment

```bash
# API health
curl -s http://45.79.219.243/api/healthz
# → {"status":"ok"}

# Check data loaded
curl -s http://45.79.219.243/api/games | head -c 200
# → Should return JSON with game records

curl -s http://45.79.219.243/api/streams | head -c 200
# → Should return JSON with stream records
```

Open the site in your browser:

```
http://45.79.219.243
```

You should see the ATA Platform home page.

---

## Step 13 — Post-import checklist

Because the database was rebuilt from `bt.sql`, confirm the following:

1. **Log in** at `http://45.79.219.243` with your admin credentials
2. Go to **Admin → Settings** and confirm Pesapal and PawaPay credentials are present
3. If you added a `pawapay_callback_token` setting for webhook security, confirm it is present — if missing, add it now and configure the matching token in the PawaPay dashboard
4. **Change the admin password** if needed: Profile → Change Password
5. Test a login, view a stream, and browse events to confirm the UI is working end-to-end

---

## Troubleshooting

| Problem | What to do |
|---------|------------|
| `git pull` asks for password | Use a Personal Access Token, not your GitHub password |
| `wc -l bt.sql` shows wrong number | The file may not have transferred — check `git status` on the server |
| Import errors mentioning a type already exists | Repeat Step 7 (the schema wipe) then retry the import |
| `migrate` service keeps restarting | Run `docker compose logs migrate` — look for schema drift errors |
| API container keeps restarting | Run `docker compose logs api --tail=50` — usually a DB connection or env var issue |
| Site loads but API returns 500 | Run `docker compose logs api` — check for missing `SESSION_SECRET` |
| Images not showing | Re-run the uploads volume copy in Step 10 |

---

## Quick reference — code-only update (no DB changes)

Use this shorter flow if you only changed code and **do not** want to wipe the database:

```bash
# On Replit
git add -A && git commit -m "describe change" && git push origin main

# On server
ssh root@45.79.219.243
cd /opt/ata
./deploy/backup.sh
git pull origin main
docker compose build
# Add new repo images without overwriting anything already on the server
docker run --rm \
  -v ata_uploads:/target \
  -v /opt/ata/artifacts/api-server/uploads:/source:ro \
  alpine sh -c "cp -rn /source/. /target/ && echo 'Done'"
docker compose up -d
docker compose ps
```

---

## Important notes

**`bt.sql` goes to GitHub** — if your repo is public the file is publicly readable and contains user PII and payment credentials. Set the repo to private first, or add `bt.sql` to `.gitignore` and transfer the file to the server separately:

```bash
# Transfer bt.sql directly from Replit to the server (bypasses GitHub)
scp bt.sql root@45.79.219.243:/opt/ata/bt.sql
```

**`pawapay_callback_token`** is a new security setting introduced in the latest update. After deployment, set a strong random token in Admin → Settings (key: `pawapay_callback_token`) and configure the same token in your PawaPay dashboard as the callback `Authorization: Bearer` header value. Until you do, PawaPay callbacks are accepted without verification (a warning is logged).
