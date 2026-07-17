# ATA Platform — Code + Schema Update Guide

**Server:** `45.79.219.243`  
**App directory:** `/opt/ata`

> ✅ This guide **does NOT wipe the database**. It only updates the code and adds two new columns to the `users` table. All existing users, wallets, bets, transactions, and settings are untouched.

---

## What this update contains

### Code changes (frontend + API)
- Navigation labels: "Bets" renamed to "Predictions" across all menus and admin panels
- SEO / Google metadata: all "betting" language replaced with "predictions" language
- Admin page titles updated to match

### New feature: Super Influencer
- Two new columns added to the `users` table:
  - `is_super_influencer` — boolean, defaults to `false`
  - `super_influencer_commission_rate` — decimal(5,2), nullable (personalised rate per super influencer)
- New API routes: `PATCH /api/admin/users/:id/set-super-influencer` and `PATCH /api/admin/users/:id/super-influencer-rate`
- Commission logic updated: super influencers use their personal rate; regular influencers continue using the global `influencer_commission_rate` setting
- Admin UI: crown 👑 button on each user row to toggle Super Influencer; inline rate editor on the Influencers page

> The `migrate` Docker service runs `drizzle-kit push --force` automatically on every `docker compose up -d`. It will detect and add the two new columns — nothing else will change.

---

## Step 1 — SSH into the server

```bash
ssh root@45.79.219.243
```

---

## Step 2 — Back up the database (do not skip)

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

## Step 3 — Pull the latest code

```bash
cd /opt/ata
git pull origin main
```

Confirm the pull succeeded and shows the new commit:

```bash
git log --oneline -3
# Top commit should be: feat: super influencer with personalised commission rate
```

---

## Step 4 — Rebuild the Docker images

This recompiles the API server and rebuilds the React frontend with all the latest changes. **Takes 3–6 minutes.**

```bash
docker compose build
```

If the build fails, try without cache:

```bash
docker compose build --no-cache
```

---

## Step 5 — Copy any new repo images into the uploads volume (non-destructive)

This adds image files from the repo that are not already on the server. The `-n` flag ensures existing server images are never overwritten or deleted.

```bash
docker run --rm \
  -v ata_uploads:/target \
  -v /opt/ata/artifacts/api-server/uploads:/source:ro \
  alpine sh -c "cp -rn /source/. /target/ && echo 'Done' && ls /target | wc -l"
```

You should see `Done` and a file count. Existing uploads are untouched.

---

## Step 6 — Start all services (runs the migration automatically)

```bash
docker compose up -d
```

The `migrate` service starts first, detects the two new columns (`is_super_influencer`, `super_influencer_commission_rate`) that are missing from the live database, adds them, then exits. The `api` and `nginx` services start after.

---

## Step 7 — Confirm the migration applied cleanly

```bash
docker compose logs migrate
```

Expected output (look for the two new columns being applied):

```
All migrations applied successfully
```

Or you may see Drizzle listing the statements it applied — that is normal and means it worked.

If the output says `No schema changes detected` that means the columns were already present — also fine.

---

## Step 8 — Verify the new columns exist in the live database

```bash
docker compose exec db psql -U ata_user -d ata_db \
  -c "SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name IN ('is_super_influencer', 'super_influencer_commission_rate')
      ORDER BY column_name;"
```

Expected output:

```
         column_name          | data_type | column_default | is_nullable
------------------------------+-----------+----------------+-------------
 is_super_influencer          | boolean   | false          | NO
 super_influencer_commission_rate | numeric | (null)        | YES
(2 rows)
```

If you get 0 rows, run the migrate service manually:

```bash
docker compose run --rm migrate
docker compose logs migrate
```

---

## Step 9 — Confirm all containers are running

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

## Step 10 — Verify the deployment

```bash
# API health check
curl -s http://45.79.219.243/api/healthz
# → {"status":"ok"}

# Confirm the site loads
curl -s -o /dev/null -w "%{http_code}" http://45.79.219.243
# → 200
```

Open the site in your browser and confirm:

1. The main nav shows **Predictions** (not Bets)
2. Admin → **Predictions** and **Manage Predictions** appear in the sidebar
3. Admin → Manage Users shows both a ⭐ (influencer) and 👑 (super influencer) button per user
4. Admin → Influencers page shows a **Super Influencers** count card
5. Log in and browse to confirm no regressions

---

## Troubleshooting

| Problem | What to do |
|---------|------------|
| `git pull` asks for a password | Use a Personal Access Token, not your GitHub password |
| `docker compose build` fails | Try `docker compose build --no-cache` |
| `migrate` logs show an enum conflict | Run `docker compose logs migrate` and check the error — for column additions this should not occur |
| `migrate` exits with no output | Run `docker compose run --rm migrate` to force a re-run and see full output |
| API container keeps restarting | Run `docker compose logs api --tail=50` — usually a DB connection or missing env var |
| New columns not appearing after migrate | Check `docker compose logs migrate`; if blank, run `docker compose run --rm migrate` |
| Site loads but Super Influencer rate save fails | Confirm the API container is on the new image: `docker compose ps` should show it restarted after `up -d` |
