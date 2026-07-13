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

## Database schema changes (adding columns, tables, or indexes)

### How it works

This project uses **Drizzle ORM** with a **push-based schema system** — there are no numbered migration files. Instead, `drizzle-kit` compares the TypeScript schema in `lib/db/src/schema/` against the live database and applies the difference.

The `migrate` Docker service (defined in `docker-compose.yml`) runs `drizzle-kit push --force` automatically **every time you run `docker compose up -d`**. It starts before the API, applies any schema changes, then exits. If there are no changes it exits immediately. You never need to run it by hand under normal conditions.

This means:

- Adding a new column or table → commit the schema change → deploy normally → it applies itself.
- The `--force` flag suppresses the interactive confirmation prompt (required for non-TTY Docker environments).
- Drizzle push **never drops data from columns that still exist** in the schema. If you remove a column from the schema it will be left in the database untouched (Drizzle does not automatically drop columns).

---

### Making a schema change — step by step

#### 1. Edit the schema file in `lib/db/src/schema/`

Each table has its own file, e.g. `users.ts`, `wallets.ts`. Add your column or table there. Export any new table from `lib/db/src/schema/index.ts`.

Example — adding a `verified_at` timestamp to users:

```ts
// lib/db/src/schema/users.ts
verifiedAt: timestamp("verified_at"),
```

#### 2. Apply the change in the dev database

`drizzle-kit push` requires an interactive TTY, which the Replit shell does not fully support. Apply the column directly with `psql` instead:

```bash
# Dev database
psql postgresql://postgres:password@helium/heliumdb \
  -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;"
```

Use `IF NOT EXISTS` so the command is safe to re-run.

#### 3. Update any API routes that read or write the new column

The Drizzle schema type is derived automatically — after saving the schema file, TypeScript will flag any queries that need updating.

#### 4. Commit and deploy

```bash
# On Replit
git add -A
git commit -m "schema: add verified_at to users"
git push origin main

# On server (SSH into 45.79.219.243)
cd /opt/ata
./deploy/backup.sh          # always back up first
git pull origin main
docker compose build        # rebuild API image with new schema
docker compose up -d        # migrate service runs automatically
docker compose logs migrate # confirm: "All migrations applied"
```

The migrate service output will show the change it applied. The API then starts with the updated schema.

---

### Verifying a schema change applied in production

```bash
# Check the column exists
docker compose exec db psql -U ata_user -d ata_db \
  -c "\d users"

# Or query the specific column
docker compose exec db psql -U ata_user -d ata_db \
  -c "SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'verified_at';"
```

---

### Emergency: running the migrate service manually

If the migrate service failed or you need to force a re-run without restarting everything:

```bash
# Run migrate as a one-off container against the live DB
docker compose run --rm migrate
```

If it still fails, check the error:

```bash
docker compose logs migrate
```

Common reasons:
- **Enum type conflict** — a custom PostgreSQL enum was renamed in the schema but already exists in the DB. Fix: either rename the enum in the DB to match, or (only if safe) drop and recreate it.
- **Column type change** — Drizzle push cannot change a column's type if data exists. Fix: run the `ALTER TABLE ... ALTER COLUMN ... TYPE ...` manually in `psql`, then re-run the migrate service.
- **DATABASE_URL not set** — check the `.env` file exists at `/opt/ata/.env` and contains `POSTGRES_PASSWORD`.

---

### Updating data in production without a schema wipe

If you need to update or insert rows (e.g. seeding new settings, fixing data) without going through the full DB-wipe flow (Steps 5–8), run SQL directly against the live container:

```bash
# Single statement
docker compose exec db psql -U ata_user -d ata_db \
  -c "INSERT INTO settings (key, value) VALUES ('my_key', 'my_value')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;"

# Multi-line script from a file
cat my_patch.sql | docker compose exec -T db psql -U ata_user -d ata_db
```

**Always back up first:**

```bash
./deploy/backup.sh
```

---

### Dropping a column or table (destructive)

Drizzle push does **not** automatically drop columns or tables you remove from the schema. You must do it manually if you want the database to match the schema exactly:

```bash
# Drop a column
docker compose exec db psql -U ata_user -d ata_db \
  -c "ALTER TABLE users DROP COLUMN IF EXISTS old_column;"

# Drop a table
docker compose exec db psql -U ata_user -d ata_db \
  -c "DROP TABLE IF EXISTS old_table;"
```

> ⚠️ Dropping a column or table is permanent. Back up first and confirm no API code still references it.

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

## Quick reference — schema-only change (new column or table, no data wipe)

Use this when you only changed `lib/db/src/schema/` and need the production database updated:

```bash
# On Replit — apply the column to dev DB first
psql postgresql://postgres:password@helium/heliumdb \
  -c "ALTER TABLE <table> ADD COLUMN IF NOT EXISTS <col> <type>;"

# Commit and push
git add -A && git commit -m "schema: describe change" && git push origin main

# On server
ssh root@45.79.219.243
cd /opt/ata
./deploy/backup.sh
git pull origin main
docker compose build
docker compose up -d           # migrate service applies the diff automatically
docker compose logs migrate    # confirm no errors
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
