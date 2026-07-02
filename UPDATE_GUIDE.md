# ATA Sports Live — Production Update Guide

**Server IP:** `173.230.131.210`  
**App directory:** `/opt/ata`  
**Domain:** `atasportslive.com`  
**Stack:** Node.js 24 · pnpm 10.26.1 · Express 5 · PostgreSQL 16 · nginx · Docker

---

## Table of Contents

- [Part A — Push Code Updates to the Server](#part-a--push-code-updates-to-the-server)
- [Part B — Safely Update the Database (Preserve Users)](#part-b--safely-update-the-database-preserve-users)
- [Part C — Accessing the Site via IP Address](#part-c--accessing-the-site-via-ip-address)
- [Part D — Point atasportslive.com to Your Server](#part-d--point-atasportslivecom-to-your-server)
- [Part E — Install the SSL Certificate (HTTPS)](#part-e--install-the-ssl-certificate-https)
- [Part F — Upgrading an Existing Server (Role Migration)](#part-f--upgrading-an-existing-server-role-migration)
- [Troubleshooting](#troubleshooting)

---

## Part A — Push Code Updates to the Server

### Step 1 — Push code from Replit to GitHub

In the Replit shell:
```bash
git add -A
git commit -m "Bug fixes and data reset"
git push origin main
```

---

### Step 2 — SSH into your Linode server

From your local machine or Replit shell:
```bash
ssh root@173.230.131.210
```

---

### Step 3 — Go to the app directory

```bash
cd /opt/ata
```

---

### Step 4 — ⚠️ Back up the database FIRST

Always do this before any update. It preserves everything — users, wallets, all data.

```bash
./deploy/backup.sh
```

Confirm the backup file was created:
```bash
ls -lh /opt/ata/backups/
```

You should see a `.sql.gz` file timestamped right now.

---

### Step 5 — Pull the latest code

```bash
git pull origin main
```

---

### Step 6 — ⚠️ Check if this update changes the role system

> **Only needed when upgrading from a version that used `moderator` or `finance` roles.**  
> Skip to Step 7 if this is a fresh server or you have already run Part F.

If your production database may have users with old roles, run Part F now — **before** rebuilding — then come back here.

How to check quickly:

```bash
docker compose exec db psql -U ata_user ata_db \
  -c "SELECT role, COUNT(*) FROM users GROUP BY role;"
```

If any row shows `moderator` or `finance`, follow **[Part F](#part-f--upgrading-an-existing-server-role-migration)** first.

---

### Step 7 — Rebuild the Docker images

```bash
docker compose build
```

This rebuilds the API server and frontend. Docker's build cache means unchanged layers are fast. Add `--no-cache` if you want a completely clean build:

```bash
docker compose build --no-cache
```

---

### Step 8 — Apply database schema changes (optional manual check)

> **Note:** Migrations run automatically every time you run `docker compose up -d` in Step 9.  
> You only need this step if you want to inspect the migration output *before* restarting.

```bash
docker compose run --rm migrate
```

Expected output (if no schema changes):
```
No changes detected — database is up to date.
```

Expected output (if new columns/tables were added):
```
[✓] Applied schema changes successfully
```

> ⚠️ **Read the output carefully.** If drizzle-kit reports it would drop any tables or columns, **stop immediately** — press `Ctrl+C`. Restore from the backup taken in Step 4 and contact your developer. Never skip the backup in Step 4.

---

### Step 9 — Restart the application

```bash
docker compose up -d
```

`docker compose up -d` automatically runs the `migrate` step before starting the API server. There is no need to run migrations separately unless you want to inspect the output first (Step 8).

---

### Step 10 — Confirm everything is running

```bash
docker compose ps
```

All three services should show `running` or `healthy`:

```
NAME       STATUS          PORTS
db         running         5432/tcp
api        running         8080/tcp
nginx      running         0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

Test the API:
```bash
curl -s http://173.230.131.210/api/games | head -c 200
```

You should get a JSON response, not an error.

---

## Part B — Safely Update the Database (Preserve Users)

The schema migration in Step 8 above handles structural changes automatically. But if you also want to clear the transaction and activity history (the same cleanup done in development) while keeping every user account intact, run this:

```bash
docker compose exec db psql -U ata_user ata_db
```

Then paste this SQL (the `users` and `wallets` tables are NOT truncated — only activity data is cleared):

```sql
BEGIN;

-- Clear activity and transaction history
TRUNCATE transactions CASCADE;
TRUNCATE bonus_transactions CASCADE;
TRUNCATE bets CASCADE;
TRUNCATE stream_access CASCADE;
TRUNCATE notifications CASCADE;
TRUNCATE stream_comments CASCADE;
TRUNCATE audit_logs CASCADE;
TRUNCATE promotion_terms_acceptance CASCADE;

-- Zero out wallet balances (since there are no transactions to explain them)
UPDATE wallets SET
  balance = 0,
  available_balance = 0,
  pending_balance = 0,
  withdrawable_balance = 0,
  bonus_balance = 0;

-- Reset game betting counters
UPDATE games SET
  total_bet_pool = 0,
  open_bets_count = 0,
  matched_bets_count = 0;

COMMIT;
```

Exit psql:
```
\q
```

User accounts, email addresses, phone numbers, passwords, and referral links are completely untouched. You can verify:

```bash
docker compose exec db psql -U ata_user ata_db -c "SELECT COUNT(*) FROM users;"
```

---

## Part C — Accessing the Site via IP Address

**Your site is already live at:**
```
http://173.230.131.210
```

No setup needed. The nginx configuration already includes the server IP in `server_name`. This works immediately and will continue to work even after the domain is pointed and SSL is installed.

Use the IP URL to test the app, log in, and verify everything works while you wait for the domain to propagate.

---

## Part D — Point atasportslive.com to Your Server

### Step 1 — Log in to your domain registrar

Go to the website where you registered `atasportslive.com` (e.g. GoDaddy, Namecheap, Google Domains, etc.) and log in.

---

### Step 2 — Find DNS settings

Look for one of these menu items in your domain's control panel:
- **DNS Management**
- **DNS Settings**
- **Manage DNS**
- **Advanced DNS**

---

### Step 3 — Add two A records

Delete any existing A records for `@` or `www` that point elsewhere, then add:

| Record Type | Name / Host | Value / Points To | TTL |
|-------------|-------------|-------------------|-----|
| **A** | `@` | `173.230.131.210` | 3600 |
| **A** | `www` | `173.230.131.210` | 3600 |

- `@` represents the root domain (`atasportslive.com`)
- `www` covers `www.atasportslive.com`
- TTL `3600` = 1 hour cache

Save the changes.

---

### Step 4 — Wait for DNS propagation

DNS changes take **15 minutes to 48 hours** to fully propagate worldwide. Check the progress at:

```
https://dnschecker.org/#A/atasportslive.com
```

You're looking for green checkmarks showing `173.230.131.210` across different countries. Once most are green, the domain is working.

---

### Step 5 — Test the domain

```bash
# From your laptop or the server
nslookup atasportslive.com
# Should return: 173.230.131.210

curl -I http://atasportslive.com
# Should return: HTTP/1.1 200 OK
```

Then open your browser and go to `http://atasportslive.com`.

> **Note:** While waiting for DNS, continue to use `http://173.230.131.210` — it always works.

---

## Part E — Install the SSL Certificate (HTTPS)

> ⚠️ **Do this ONLY after** `atasportslive.com` is pointing to your server and `http://atasportslive.com` loads correctly. Certbot verifies ownership of the domain before issuing a certificate.

---

### Step 1 — SSH into the server

```bash
ssh root@173.230.131.210
cd /opt/ata
```

---

### Step 2 — Install Certbot

```bash
apt update
apt install -y certbot
```

---

### Step 3 — Stop nginx to free port 80

Certbot needs to briefly use port 80 to prove you own the domain.

```bash
docker compose stop nginx
```

---

### Step 4 — Request the SSL certificate

```bash
certbot certonly \
  --standalone \
  --non-interactive \
  --agree-tos \
  --email info@atasportslive.com \
  -d atasportslive.com \
  -d www.atasportslive.com
```

Certbot will:
1. Start a temporary server on port 80
2. Prove you control the domain
3. Download your certificate
4. Save it to `/etc/letsencrypt/live/atasportslive.com/`

You should see:
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/atasportslive.com/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/atasportslive.com/privkey.pem
This certificate expires on YYYY-MM-DD.
```

---

### Step 5 — Switch to the HTTPS nginx configuration

```bash
cp deploy/nginx-ssl.conf deploy/nginx.conf
```

The new config:
- Redirects all `http://atasportslive.com` → `https://` automatically
- Enables HTTP/2 for faster loading
- Adds HSTS so browsers always use HTTPS going forward
- Still serves `http://173.230.131.210` (bare IP) for your admin access

Because nginx reads its config from a bind-mounted file (not baked into the image), you only need to **restart** — no image rebuild required.

---

### Step 6 — Restart nginx

```bash
docker compose restart nginx
```

---

### Step 7 — Test HTTPS

```bash
curl -I https://atasportslive.com
```

Expected output:
```
HTTP/2 200
server: nginx
...
strict-transport-security: max-age=31536000; includeSubDomains; preload
```

Open your browser and visit `https://atasportslive.com` — you should see the padlock icon in the address bar.

---

### Step 8 — Set up automatic certificate renewal

Let's Encrypt certificates expire after 90 days. Set up a cron job to renew automatically (before they expire):

```bash
# Make the renewal script executable
chmod +x /opt/ata/deploy/renew-ssl.sh

# Open the cron editor
crontab -e
```

Add this line at the bottom (renews on the 1st and 15th of every month at 3am):

```
0 3 1,15 * * /opt/ata/deploy/renew-ssl.sh >> /var/log/ata-ssl-renew.log 2>&1
```

Save and close (`:wq` in vim, or `Ctrl+O` then `Ctrl+X` in nano).

Verify the cron was saved:
```bash
crontab -l
```

---

## Part F — Upgrading an Existing Server (Role Migration)

> **Only needed if your production database was deployed from an older version** of this app that used the roles `moderator` or `finance`. These roles no longer exist — they have been replaced by `manager`. If this is a fresh install, skip this entire section.

The database now uses a PostgreSQL enum type (`user_role`) for the role column. If existing users have the old role values `moderator` or `finance`, the schema migration (`migrate` service) will fail with a type conflict error.

### Step F.1 — Check if you are affected

```bash
docker compose exec db psql -U ata_user ata_db \
  -c "SELECT role, COUNT(*) FROM users GROUP BY role;"
```

If you see `moderator` or `finance` in the output, continue with the steps below. If you only see `user`, `content_editor`, `manager`, or `admin`, you are not affected — skip to Part A Step 7.

---

### Step F.2 — Convert old roles to the new system

Run this **before** rebuilding the Docker images or running the migration:

```bash
docker compose exec db psql -U ata_user ata_db
```

Then paste this SQL:

```sql
BEGIN;

-- Rename the old role column to a plain text type so we can update values freely.
-- (Only needed if the column is currently a constrained type or enum.)
ALTER TABLE users ALTER COLUMN role TYPE text;

-- Map old roles to their new equivalents:
--   moderator → manager  (had moderation powers; manager is the direct replacement)
--   finance   → manager  (had payment-approval powers; manager now handles this)
UPDATE users SET role = 'manager'
  WHERE role IN ('moderator', 'finance');

-- Confirm no old values remain
SELECT role, COUNT(*) FROM users GROUP BY role;

COMMIT;
```

Exit psql:
```
\q
```

You should see only `user`, `content_editor`, `manager`, or `admin` in the output.

---

### Step F.3 — Continue the normal update

Now go back to **Part A Step 7** and proceed normally. The schema migration will create the `user_role` enum and convert the `role` column cleanly because the data no longer contains any unrecognised values.

---

### New role structure reference

The platform now uses four roles:

| Role | Admin panel access | What they can do |
|------|--------------------|-----------------|
| `user` | None | Public/registered user |
| `content_editor` | Dashboard, Hero Slides, Highlights, Announcements, Ad Slots, Users (view only) | Manage site content |
| `manager` | Everything except SMTP / Pesapal / PawaPay / DB Backup settings | Credit/debit/suspend users, approve withdrawals, manage promotions |
| `admin` | Full access | All of the above plus payment gateway settings and DB backup |

> **Note:** A `manager` cannot manage other managers or admins — only users below their own level.

---

## Troubleshooting

### Services not starting after update

Check the logs:
```bash
docker compose logs api --tail=50
docker compose logs nginx --tail=50
docker compose logs db --tail=50
```

### Migration fails with "invalid input value for enum user_role"

Your database has users with old role values (`moderator` or `finance`). Follow **[Part F](#part-f--upgrading-an-existing-server-role-migration)** to convert them, then re-run the update.

```bash
# Quick diagnosis
docker compose exec db psql -U ata_user ata_db \
  -c "SELECT role, COUNT(*) FROM users GROUP BY role;"
```

### Migration fails with "cannot drop type" or enum conflict

The `user_role` enum already exists in the database but with different values. Before dropping it, confirm nothing else depends on it:

```bash
docker compose exec db psql -U ata_user ata_db
```

```sql
-- Check what depends on the enum (should only be users.role)
SELECT pg_class.relname AS table, pg_attribute.attname AS column
FROM pg_type
JOIN pg_attribute ON pg_attribute.atttypid = pg_type.oid
JOIN pg_class     ON pg_class.oid = pg_attribute.attrelid
WHERE pg_type.typname = 'user_role';
```

If only `users.role` is listed, it is safe to continue:

```sql
-- Convert role column to plain text so the enum can be dropped
ALTER TABLE users ALTER COLUMN role TYPE text;

-- Drop the old enum (safe only after confirming no other dependencies above)
DROP TYPE IF EXISTS user_role;
```

If the dependency check shows other tables using `user_role`, **do not drop the enum** — restore from the backup taken in Step 4 and contact your developer.

Exit psql, then re-run the migration:
```bash
docker compose run --rm migrate
```

### Database migration failed (other reasons)

Restore from the backup you took in Step 4:
```bash
# Find your backup file
ls /opt/ata/backups/

# Restore (replace TIMESTAMP with your actual filename)
gunzip -c /opt/ata/backups/ata_backup_TIMESTAMP.sql.gz \
  | docker compose exec -T db psql -U ata_user ata_db
```

### Certbot fails with "port 80 in use"

Make sure nginx is stopped:
```bash
docker compose stop nginx
# Wait 5 seconds then retry certbot
```

### Certbot fails with "domain not found" or "connection refused"

The domain isn't pointing to your server yet. Check:
```bash
nslookup atasportslive.com
```
It must return `173.230.131.210`. Wait for DNS propagation and try again.

### HTTPS works but images/uploads are broken

Check the uploads volume is mounted in nginx:
```bash
docker compose config | grep uploads
```

### WebSocket disconnects frequently

If using HTTPS, make sure port 443 is open in Linode's firewall:
```bash
ufw status
ufw allow 80/tcp
ufw allow 443/tcp
```

### Check Linode firewall (if site is unreachable)

Log in to cloud.linode.com → Your server → Firewalls → ensure ports 22, 80, and 443 are allowed for inbound traffic.

### Admin panel shows wrong role options for users

The admin user management page now shows four roles: `user`, `content_editor`, `manager`, `admin`. If you see old labels like `moderator` in the dropdown, hard-refresh the browser (`Ctrl+Shift+R`) to clear the cached frontend bundle.
