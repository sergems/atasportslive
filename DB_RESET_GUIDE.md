# ATA Platform — Database Reset & Rebuild Guide

**Use this guide when you want to wipe the server database completely and rebuild it from scratch using `dt.sql`.**

> ⚠️ This permanently deletes all data on the server — users, wallets, bets, transactions, everything.  
> Only do this when you are absolutely sure you want a clean slate.

---

## What this does

1. Pushes the latest code (including `dt.sql`) from Replit to GitHub  
2. Pulls it onto the Linode server  
3. Takes a safety backup of the current database  
4. Drops every table and type in the database  
5. Rebuilds all tables from `dt.sql`  
6. Rebuilds Docker images and restarts the app  
7. Verifies everything is running  

---

## Step 1 — Push the latest code from Replit to GitHub

Run this in the **Replit shell**:

```bash
git add -A
git commit -m "Database reset and schema rebuild"
git push origin main
```

Wait until the push completes before moving to Step 2.

---

## Step 2 — SSH into the server

```bash
ssh root@173.230.131.210
```

---

## Step 3 — Go to the app directory and pull the latest code

```bash
cd /opt/ata
git pull origin main
```

Confirm `dt.sql` is present:

```bash
ls -lh dt.sql
# Should show the file with a recent date
```

---

## Step 4 — Take a safety backup (always do this first)

```bash
./deploy/backup.sh
ls -lh /opt/ata/backups/
```

You should see a `.sql.gz` file with today's timestamp. This is your safety net — if anything goes wrong, you can restore from here.

---

## Step 5 — Stop the API and nginx (keep the database running)

```bash
docker compose stop api nginx
```

Verify only `db` is still running:

```bash
docker compose ps
```

Expected:
```
NAME        STATUS
ata-db-1    Up (healthy)
ata-api-1   Exited
ata-nginx-1 Exited
```

---

## Step 6 — Drop all tables and types

Open a database shell:

```bash
docker compose exec db psql -U ata_user -d ata_db
```

Paste this entire block and press Enter:

```sql
-- Drop all tables
DROP TABLE IF EXISTS
  announcements,
  audit_logs,
  bets,
  bonus_transactions,
  games,
  hero_slides,
  highlights,
  notifications,
  promotion_terms_acceptance,
  promotions,
  settings,
  stream_access,
  stream_comments,
  streams,
  transactions,
  users,
  vouchers,
  wallets
CASCADE;

-- Drop all custom types
DROP TYPE IF EXISTS
  bet_outcome,
  bet_status,
  game_result,
  game_sport,
  game_status,
  notification_type,
  payment_method,
  sport_type,
  stream_status,
  transaction_status,
  transaction_type,
  user_role,
  user_status
CASCADE;
```

Confirm everything is gone:

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- Should return 0 rows (empty)
```

Exit the database shell:

```
\q
```

---

## Step 7 — Import dt.sql

```bash
docker compose exec -T db psql -U ata_user -d ata_db < /opt/ata/dt.sql
```

You will see a stream of output ending with lines like:

```
...
ALTER TABLE
ALTER TABLE
REVOKE
GRANT
```

That is normal and means it succeeded.

---

## Step 8 — Verify the tables were created

```bash
docker compose exec db psql -U ata_user -d ata_db \
  -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
```

You should see all 18 tables:

```
announcements
audit_logs
bets
bonus_transactions
games
hero_slides
highlights
notifications
promotion_terms_acceptance
promotions
settings
stream_access
stream_comments
streams
transactions
users
vouchers
wallets
```

If the list looks correct, continue. If any tables are missing, stop and restore from the backup in Step 4.

---

## Step 9 — Rebuild Docker images

This picks up any code changes that came with the `git pull`:

```bash
docker compose build
```

This usually takes 1–3 minutes. Add `--no-cache` only if you suspect a stale build:

```bash
docker compose build --no-cache
```

---

## Step 10 — Start everything

```bash
docker compose up -d
```

This starts `db`, `api`, and `nginx` together. The `migrate` service will run automatically — it will detect no schema changes (since `dt.sql` already created everything) and exit cleanly.

---

## Step 11 — Verify everything is running

```bash
docker compose ps
```

Expected:

```
NAME        STATUS          PORTS
ata-db-1    Up (healthy)
ata-api-1   Up
ata-nginx-1 Up              0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

Test the API:

```bash
curl -s http://173.230.131.210/api/games
# Should return a JSON response (empty array is fine: [])
```

Open the site in your browser:

```
http://173.230.131.210
```

You should see the ATA Platform home page with **Live: 0** and an empty events list — confirming the database is clean and the app is running correctly.

---

## Step 12 — Log in as admin and reconfigure settings

The database is now fresh. Your admin account needs to be re-created and payment gateways reconfigured.

### 12.1 Check if the admin account exists

```bash
docker compose exec db psql -U ata_user -d ata_db \
  -c "SELECT id, email, role FROM users;"
```

If `dt.sql` included seed data you will see the admin account. If the table is empty, register a new account through the app and then promote it:

```bash
docker compose exec db psql -U ata_user -d ata_db
```

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
\q
```

### 12.2 Payment gateway settings

Your Pesapal and PawaPay credentials are stored in the `settings` table, which is included in `dt.sql`. They will be restored automatically — no need to re-enter anything. You can verify in **Admin → Settings** that the values are present.

---

## Restore from backup (if anything went wrong)

If the reset failed at any point, restore the backup taken in Step 4:

```bash
# Find the backup file
ls -lh /opt/ata/backups/

# Stop the app first
docker compose stop api nginx

# Restore (replace the filename with your actual backup)
gunzip -c /opt/ata/backups/ata_backup_YYYYMMDD_HHMMSS.sql.gz \
  | docker compose exec -T db psql -U ata_user -d ata_db

# Restart
docker compose up -d
```

---

## Quick summary (copy-paste version)

Once you have completed the guide once and are confident, here is the condensed version for future resets:

```bash
# On Replit shell
git add -A && git commit -m "reset" && git push origin main

# On Linode server
ssh root@173.230.131.210
cd /opt/ata
git pull origin main
./deploy/backup.sh

docker compose stop api nginx

docker compose exec db psql -U ata_user -d ata_db -c "
DROP TABLE IF EXISTS announcements, audit_logs, bets, bonus_transactions, games, hero_slides, highlights, notifications, promotion_terms_acceptance, promotions, settings, stream_access, stream_comments, streams, transactions, users, vouchers, wallets CASCADE;
DROP TYPE IF EXISTS bet_outcome, bet_status, game_result, game_sport, game_status, notification_type, payment_method, sport_type, stream_status, transaction_status, transaction_type, user_role, user_status CASCADE;
"

docker compose exec -T db psql -U ata_user -d ata_db < /opt/ata/dt.sql

docker compose build
docker compose up -d
docker compose ps
```
