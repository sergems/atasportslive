# ATA Sports Live — Production Update Guide

**Server IP:** `173.230.131.210`  
**App directory:** `/opt/ata`  
**Domain:** `atasportslive.com`

---

## Table of Contents

- [Part A — Push Code Updates to the Server](#part-a--push-code-updates-to-the-server)
- [Part B — Safely Update the Database (Preserve Users)](#part-b--safely-update-the-database-preserve-users)
- [Part C — Accessing the Site via IP Address](#part-c--accessing-the-site-via-ip-address)
- [Part D — Point atasportslive.com to Your Server](#part-d--point-atasportslivecOM-to-your-server)
- [Part E — Install the SSL Certificate (HTTPS)](#part-e--install-the-ssl-certificate-https)
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

### Step 6 — Rebuild the Docker images

```bash
docker compose build
```

This rebuilds the API server and frontend. It uses Docker's build cache so unchanged layers are fast. Add `--no-cache` if you want a completely clean build:

```bash
docker compose build --no-cache
```

---

### Step 7 — Apply database schema changes

This syncs the database structure with the latest code. It compares the current schema definition to the live database and applies the differences.

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

> ⚠️ **Read the output carefully.** If drizzle-kit reports it would drop any tables or columns, **stop immediately** — type `n` or press `Ctrl+C`. Restore from the backup taken in Step 4 and contact your developer. Never skip the backup in Step 4.

---

### Step 8 — Restart the application

```bash
docker compose up -d
```

---

### Step 9 — Confirm everything is running

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

The schema migration in Step 7 above handles structural changes automatically. But if you also want to clear the transaction and activity history on the server (the same cleanup done in development) while keeping every user account intact, run this:

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

## Troubleshooting

### Services not starting after update

Check the logs:
```bash
docker compose logs api --tail=50
docker compose logs nginx --tail=50
docker compose logs db --tail=50
```

### Database migration failed

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
