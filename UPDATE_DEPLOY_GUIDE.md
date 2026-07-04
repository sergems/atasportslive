# ATA Platform — Update Deployment Guide

**Server:** `45.79.219.243`  
**App directory:** `/opt/ata`  
**Use this guide** every time you want to deploy a new version from Replit to the live server.

> ⚠️ This guide **drops and rebuilds the entire database** from the fresh Replit dump (`dt.sql`).  
> All server-side data (users, bets, wallets, payments) will be **permanently deleted**.  
> If you only want to deploy code without touching the database, skip Steps 5–7 and go straight to Step 8.

---

## Step 1 — Push the latest code to GitHub (on Replit)

Run this in the **Replit Shell** tab:

```bash
git add -A
git commit -m "Update: describe what changed"
git push origin main
```

Wait for the push to complete before touching the server.  
The fresh `dt.sql` database dump is included in this push.

---

## Step 2 — SSH into the server

```bash
ssh root@45.79.219.243
```

---

## Step 3 — Back up the existing database (IMPORTANT — do not skip)

```bash
cd /opt/ata
./deploy/backup.sh
ls -lh /opt/ata/backups/
```

You should see a new `.sql.gz` file with today's date. If the backup script fails for any reason, run this manually:

```bash
docker compose exec db pg_dump -U ata_user ata_db | gzip > /opt/ata/backups/manual-backup-$(date +%Y%m%d-%H%M%S).sql.gz
```

**Do not proceed until you have a backup file.**

---

## Step 4 — Pull the latest code

```bash
cd /opt/ata
git pull origin main
```

If Git asks for credentials, use your GitHub username and Personal Access Token (not your password).

Confirm the new `dt.sql` arrived:

```bash
wc -l dt.sql
# Should print a number close to 12000 or more
```

---

## Step 5 — Stop all running services

```bash
docker compose down
```

Wait until all containers stop:

```bash
docker compose ps
# Should show nothing (all stopped)
```

---

## Step 6 — Drop all existing tables and rebuild from the new dump

Start only the database container:

```bash
docker compose up -d db
```

Wait until it is healthy (press `Ctrl+C` once you see `(healthy)`):

```bash
watch docker compose ps
```

Now drop every table in the database:

```bash
docker compose exec db psql -U ata_user -d ata_db -c "
DO \$\$ DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END \$\$;
"
```

Confirm everything is gone (should return zero rows):

```bash
docker compose exec db psql -U ata_user -d ata_db \
  -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
```

---

## Step 7 — Import the fresh database dump

```bash
docker compose exec -T db psql -U ata_user -d ata_db < /opt/ata/dt.sql
```

This will print many lines of SQL output. The last few lines should look like:

```
...
ALTER TABLE
ALTER TABLE
```

Verify all tables were created:

```bash
docker compose exec db psql -U ata_user -d ata_db \
  -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
```

You should see a full list of tables (users, wallets, games, bets, streams, etc.). If any are missing, stop here — do not proceed.

---

## Step 8 — Rebuild the Docker images

This recompiles the API server and rebuilds the frontend with the new code. **Takes 3–6 minutes.**

```bash
docker compose build
```

Wait for it to finish. If the build fails, run with no cache:

```bash
docker compose build --no-cache
```

---

## Step 9 — Copy uploaded images into the Docker volume

New images added in Replit (event thumbnails, hero slides, etc.) need to be copied into the Docker volume:

```bash
docker run --rm \
  -v ata_uploads:/target \
  -v /opt/ata/artifacts/api-server/uploads:/source:ro \
  alpine sh -c "cp -r /source/. /target/ && echo 'Done' && ls /target | head -10"
```

You should see `Done` followed by a list of image files.

---

## Step 10 — Start all services

```bash
docker compose up -d
```

Watch the logs to confirm everything starts cleanly:

```bash
docker compose logs -f --tail=50
```

Press `Ctrl+C` once you see the API log lines like:
```
Server listening on port 3000
```

Check that all containers are running:

```bash
docker compose ps
```

Expected output:

```
NAME          STATUS          PORTS
ata-db-1      Up (healthy)
ata-api-1     Up
ata-nginx-1   Up              0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

---

## Step 11 — Verify the deployment

Test the API:

```bash
curl -s http://45.79.219.243/api/games
# Should return JSON (empty array [] is fine)

curl -s http://45.79.219.243/api/streams
# Should return JSON
```

Open the site in your browser:

```
http://45.79.219.243
```

You should see the ATA Platform home page with the updated hero slides.

---

## Step 12 — Re-enter admin settings

Because the database was rebuilt from the Replit dump, the settings that came with `dt.sql` are already there. But confirm:

1. Log in at `http://45.79.219.243` with the admin credentials
2. Go to **Admin → Settings**
3. Confirm Pesapal and PawaPay credentials are present
4. If any are missing, re-enter them manually
5. **Change the admin password immediately** if this is a fresh database: Profile → Change Password

---

## Troubleshooting

| Problem | What to do |
|---------|------------|
| `git pull` asks for password | Use a Personal Access Token, not your GitHub password |
| `docker compose build` fails | Try `docker compose build --no-cache` |
| Tables not created after import | Check `dt.sql` arrived correctly — `wc -l /opt/ata/dt.sql` should be ~12000+ |
| API container keeps restarting | `docker compose logs api --tail=50` to see the error |
| Site loads but API returns errors | `docker compose logs api` — check for DB connection errors |
| Images not showing | Re-run the uploads volume copy command in Step 9 |
| Database import errors | Stop the db container, `docker compose up -d db`, then retry the import |

---

## Quick reference — code-only update (no DB changes)

If you only changed frontend or API code and the database schema is **unchanged**, use this shorter flow:

```bash
# On Replit
git add -A && git commit -m "describe change" && git push origin main

# On server
ssh root@45.79.219.243
cd /opt/ata
./deploy/backup.sh
git pull origin main
docker compose build
docker run --rm \
  -v ata_uploads:/target \
  -v /opt/ata/artifacts/api-server/uploads:/source:ro \
  alpine sh -c "cp -r /source/. /target/"
docker compose up -d
docker compose ps
```
