# ATA Platform — Full Redeploy Guide (Code + DB Wipe + bt.sql Import)

**Server:** `45.79.219.243`  
**App directory:** `/opt/ata`

> ⚠️ This guide **completely wipes and rebuilds the production database** from `bt.sql`.  
> All existing server-side data (users, bets, wallets, transactions) will be **permanently deleted**.  
> Uploaded images already on the server are **never touched** — the copy step uses `-n` (no-clobber).

---

## What this update contains

- All code changes pushed to GitHub (label renames, SEO fixes, Super Influencer feature)
- Full database wipe and reimport from `bt.sql`
- Two new schema columns applied automatically after import (`is_super_influencer`, `super_influencer_commission_rate`)

---

## Step 1 — Commit and push the code to GitHub (on Replit)

Run this in the **Replit Shell** tab:

```bash
git add -A && git commit -m "Full redeploy: super influencer + predictions update" && git push origin main
```

Wait for the push to finish before touching the server.

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

Confirm a new `.sql.gz` file with today's date appears. If the script fails, run manually:

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

## Step 7 — Wipe the database completely

Drops the entire `public` schema — all tables, indexes, sequences, and enum types — then recreates it clean. Required because `bt.sql` defines its own enums and a leftover type will cause the import to fail.

```bash
docker compose exec db psql -U ata_user -d ata_db -c "
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO ata_user;
GRANT ALL ON SCHEMA public TO public;
"
```

Expected output:
```
DROP SCHEMA
CREATE SCHEMA
GRANT
GRANT
```

Verify it is empty (should return zero rows):

```bash
docker compose exec db psql -U ata_user -d ata_db \
  -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
```

---

## Step 8 — Import bt.sql

`bt.sql` has two proprietary wrapper lines (line 5 and line 12183) that must be stripped before PostgreSQL can read it. This command does that automatically:

```bash
sed -e '5d' -e '12183d' /opt/ata/bt.sql | docker compose exec -T db psql -U ata_user -d ata_db
```

The import prints many lines of SQL output. The last few should look like:

```
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

Expected tables:
```
announcements, audit_logs, bets, bonus_transactions, games, hero_slides, highlights,
notifications, platform_subscriptions, promotion_terms_acceptance, promotions, settings,
stream_access, stream_comments, streams, transactions, users, vouchers, wallets
```

**If any table is missing, stop here and do not continue until the list is complete.**

---

## Step 9 — Rebuild the Docker images

Recompiles the API server and rebuilds the React frontend with all latest code changes. **Takes 3–6 minutes.**

```bash
docker compose build
```

If the build fails, try without cache:

```bash
docker compose build --no-cache
```

---

## Step 10 — Copy new repo images into the Docker volume (non-destructive)

Adds any image files from the repo that are **not already on the server**. The `-n` flag (no-clobber) means existing server-uploaded images are **never overwritten or deleted**.

```bash
docker run --rm \
  -v ata_uploads:/target \
  -v /opt/ata/artifacts/api-server/uploads:/source:ro \
  alpine sh -c "cp -rn /source/. /target/ && echo 'Done' && ls /target | wc -l"
```

You should see `Done` followed by the total image count. Existing files are untouched.

---

## Step 11 — Start all services

```bash
docker compose up -d
```

The `migrate` service runs automatically first. It will detect the two new columns (`is_super_influencer`, `super_influencer_commission_rate`) that are not in `bt.sql` and apply them to the live database. The API and Nginx start after.

Watch the logs to confirm a clean startup:

```bash
docker compose logs -f --tail=60
```

Press `Ctrl+C` once you see:

```
ata-api-1   | {"level":30,"msg":"ATA Platform server listening","port":8080}
ata-api-1   | {"level":30,"msg":"Bonus expiry cron started"}
```

Check all containers are running:

```bash
docker compose ps
```

Expected:

```
NAME          STATUS            PORTS
ata-db-1      Up (healthy)
ata-api-1     Up
ata-nginx-1   Up                0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

---

## Step 12 — Verify the new schema columns were applied

```bash
docker compose exec db psql -U ata_user -d ata_db \
  -c "SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name IN ('is_super_influencer', 'super_influencer_commission_rate')
      ORDER BY column_name;"
```

Expected:

```
         column_name              | data_type
----------------------------------+-----------
 is_super_influencer              | boolean
 super_influencer_commission_rate | numeric
(2 rows)
```

If you get 0 rows, force the migration manually:

```bash
docker compose run --rm migrate
docker compose logs migrate
```

---

## Step 13 — Verify the deployment

```bash
# API health
curl -s http://45.79.219.243/api/healthz
# → {"status":"ok"}

# Check data loaded
curl -s http://45.79.219.243/api/games | head -c 200
curl -s http://45.79.219.243/api/streams | head -c 200
```

Open the site in your browser:

```
http://45.79.219.243
```

---

## Step 14 — Post-deploy checklist

1. **Log in** with your admin credentials
2. Go to **Admin → Settings** and confirm Pesapal and PawaPay credentials are present
3. Confirm `pawapay_callback_token` setting is present — if missing, add it and set the matching token in the PawaPay dashboard
4. Check the main nav shows **Predictions** (not Bets)
5. Check **Admin → Predictions** and **Manage Predictions** appear in the sidebar
6. Check **Admin → Manage Users** shows both ⭐ and 👑 buttons per user
7. Check **Admin → Influencers** shows the Super Influencers count card
8. **Change the admin password** if needed: Profile → Change Password

---

## Troubleshooting

| Problem | What to do |
|---------|------------|
| `git pull` asks for password | Use a Personal Access Token, not your GitHub password |
| `wc -l bt.sql` shows wrong number | File may not have transferred — check `git status` on the server |
| Import errors mentioning a type already exists | Repeat Step 7 (schema wipe) then retry the import |
| `migrate` service keeps restarting | Run `docker compose logs migrate` — look for schema drift errors |
| API container keeps restarting | Run `docker compose logs api --tail=50` — usually a DB connection or env var issue |
| Site loads but API returns 500 | Run `docker compose logs api` — check for missing `SESSION_SECRET` |
| Images not showing | Re-run the uploads volume copy in Step 10 |
| New columns missing after migrate | Run `docker compose run --rm migrate` and check logs |
