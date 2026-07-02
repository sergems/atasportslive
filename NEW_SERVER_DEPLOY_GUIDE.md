# ATA Platform — New Server Deployment Guide

**Server IP:** `45.79.219.243`  
**Future domain:** `hatasportslive.com`  
**GitHub repo:** `https://github.com/sergems/atasportslive`  
**Stack:** Node.js 24 · pnpm 10.26.1 · Express 5 · PostgreSQL 16 · nginx · Docker

---

## Overview

```
Replit  →  GitHub  →  Linode server (45.79.219.243)
(code)      (repo)     (Docker containers)
```

Three containers run on the server:

| Container | Role | Port |
|-----------|------|------|
| `db`      | PostgreSQL 16 — all data | Internal only |
| `api`     | Express API + WebSocket  | Internal only |
| `nginx`   | Serves frontend + proxies API | 80 (→ 443 once SSL is set up) |

---

## Part 1 — Push the latest code to GitHub

Run this in the **Replit shell** before touching the server:

```bash
git add -A
git commit -m "Initial production deployment"
git push origin main
```

Wait for the push to complete.

---

## Part 2 — First-time server setup

### 2.1 SSH into the new server

```bash
ssh root@45.79.219.243
```

---

### 2.2 Update the system

```bash
apt-get update && apt-get upgrade -y
```

---

### 2.3 Install Git

```bash
apt-get install -y git
```

---

### 2.4 Install Docker

```bash
curl -fsSL https://get.docker.com | sh
```

Verify:

```bash
docker --version
# Docker version 27.x.x or later
```

---

### 2.5 Install Docker Compose plugin

```bash
apt-get install -y docker-compose-plugin
docker compose version
# Docker Compose version v2.x.x or later
```

---

### 2.6 Set up the firewall

```bash
apt-get install -y ufw
ufw allow 22      # SSH — always keep this open first
ufw allow 80      # HTTP
ufw allow 443     # HTTPS (needed later for the domain + SSL)
ufw enable
ufw status
```

Expected output:
```
Status: active
To          Action  From
--          ------  ----
22          ALLOW   Anywhere
80          ALLOW   Anywhere
443         ALLOW   Anywhere
```

---

## Part 3 — Clone the repository

```bash
git clone https://github.com/sergems/atasportslive.git /opt/ata
cd /opt/ata
```

> If GitHub asks for credentials, use your GitHub username and a **Personal Access Token** (not your password).  
> Create one at: **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)** with the `repo` scope.

---

## Part 4 — Configure environment variables

### 4.1 Create the .env file

```bash
cp deploy/.env.example .env
nano .env
```

Fill in every value:

```env
# Strong random password for PostgreSQL (min 32 chars)
POSTGRES_PASSWORD=   ← paste output of: openssl rand -base64 32

# Strong random secret for JWT signing (min 64 chars)
SESSION_SECRET=      ← paste output of: openssl rand -base64 64

# Weekly backup email notification (Gmail recommended)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail-address@gmail.com
SMTP_PASS=your-16-char-app-password
NOTIFY_EMAIL=info@hatasportslive.com
```

Generate the secure values right now (run these on the server, copy the outputs into .env):

```bash
openssl rand -base64 32   # → POSTGRES_PASSWORD
openssl rand -base64 64   # → SESSION_SECRET
```

> **Gmail App Password:** Go to myaccount.google.com → Security → 2-Step Verification (turn on) → App Passwords → create one called "ATA Backup". Copy the 16-character password into `SMTP_PASS`.

### 4.2 Lock down the .env file

```bash
chmod 600 /opt/ata/.env
```

---

## Part 5 — Start the database

Start only the database container first, then wait for it to be healthy before importing data.

```bash
cd /opt/ata
docker compose up -d db
```

Watch until it shows `(healthy)` — usually takes 15–30 seconds:

```bash
watch docker compose ps
```

Expected output (press `Ctrl+C` once you see healthy):
```
NAME        STATUS
ata-db-1    Up (healthy)
```

---

## Part 6 — Import the database from dt.sql

This builds all tables and loads the initial data (including settings, hero slides, and any seed content) directly from `dt.sql`. This avoids the interactive drizzle-kit prompts entirely.

```bash
docker compose exec -T db psql -U ata_user -d ata_db < /opt/ata/dt.sql
```

You will see a stream of output. The last few lines should look like:

```
...
ALTER TABLE
ALTER TABLE
REVOKE
GRANT
```

Verify the tables were created:

```bash
docker compose exec db psql -U ata_user -d ata_db \
  -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
```

You should see all 18 tables listed. If anything looks wrong, stop here — do not proceed until the table list is complete.

---

## Part 7 — Build the Docker images

This compiles the TypeScript API server and builds the React frontend. **Takes 3–6 minutes on first run.**

```bash
docker compose build
```

You will see output from multiple build stages (deps → builder → api → nginx). Wait for it to complete fully.

---

## Part 8 — Start all services

```bash
docker compose up -d
```

The `migrate` service runs automatically. Because `dt.sql` already created all the tables, it will detect no changes and exit cleanly with:

```
No changes detected — database is up to date.
```

Then `api` and `nginx` start.

---

## Part 9 — Verify everything is running

```bash
docker compose ps
```

Expected output:

```
NAME        STATUS          PORTS
ata-db-1    Up (healthy)
ata-api-1   Up
ata-nginx-1 Up              0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

Test the API:

```bash
curl -s http://45.79.219.243/api/games
# Should return a JSON response (empty array [] is fine)
```

Open the site in your browser:

```
http://45.79.219.243
```

You should see the ATA Platform home page. ✓

---

## Part 10 — Admin setup

### 10.1 Log in as admin

Open **http://45.79.219.243** in your browser and sign in with the admin credentials that came with `dt.sql`. **Change the password immediately** after logging in: Profile → Change Password.

### 10.2 Verify payment gateway settings

Go to **Admin → Settings** and confirm Pesapal and PawaPay credentials are present (they are stored in the `settings` table which was imported with `dt.sql`).

### 10.3 Enable the gateways

Each gateway has a toggle switch in **Admin → Settings**. Turn them **ON** when you are ready for users to deposit.

---

## Part 11 — Set up automatic database backups

### 11.1 Make the scripts executable

```bash
chmod +x /opt/ata/deploy/backup.sh
chmod +x /opt/ata/deploy/notify-backup.py
chmod +x /opt/ata/deploy/renew-ssl.sh
```

### 11.2 Create the backups folder

```bash
mkdir -p /opt/ata/backups
```

### 11.3 Test the backup script

```bash
/opt/ata/deploy/backup.sh
ls -lh /opt/ata/backups/
```

You should see a `.sql.gz` file with today's timestamp.

### 11.4 Test the email notification

```bash
python3 /opt/ata/deploy/notify-backup.py
```

Check `info@hatasportslive.com` — you should receive a notification email within a minute.

### 11.5 Schedule with cron

```bash
crontab -e
```

Add these two lines at the bottom:

```cron
# Daily database backup at 02:00 AM
0 2 * * * /opt/ata/deploy/backup.sh >> /var/log/ata-backup.log 2>&1

# Weekly email notification every Monday at 08:00 AM
0 8 * * 1 python3 /opt/ata/deploy/notify-backup.py >> /var/log/ata-backup.log 2>&1
```

Save and exit (nano: `Ctrl+O` → Enter → `Ctrl+X`).

Verify:

```bash
crontab -l
```

---

## Part 12 — Point the domain and install SSL

> **Do this only after `hatasportslive.com` is registered and you are ready to go live.**  
> The site works fine on the IP address until then.

### 12.1 Point DNS to the server

In your domain registrar's DNS panel, add:

| Type | Name  | Value            | TTL  |
|------|-------|------------------|------|
| `A`  | `@`   | `45.79.219.243`  | 3600 |
| `A`  | `www` | `45.79.219.243`  | 3600 |

Wait for DNS to propagate (5 minutes to 48 hours). Check progress at:

```
https://dnschecker.org/#A/hatasportslive.com
```

Once most locations show `45.79.219.243`, test it:

```bash
curl -I http://hatasportslive.com
# Should return: HTTP/1.1 200 OK
```

### 12.2 Install Certbot

```bash
apt-get install -y certbot
```

### 12.3 Stop nginx to free port 80

```bash
docker compose stop nginx
```

### 12.4 Issue the SSL certificate

```bash
certbot certonly \
  --standalone \
  --non-interactive \
  --agree-tos \
  --email info@hatasportslive.com \
  -d hatasportslive.com \
  -d www.hatasportslive.com
```

Expected output:
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/hatasportslive.com/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/hatasportslive.com/privkey.pem
```

### 12.5 Switch to the HTTPS nginx config

The SSL config is already in the repo at `deploy/nginx-ssl.conf`. Copy it over:

```bash
cp /opt/ata/deploy/nginx-ssl.conf /opt/ata/deploy/nginx.conf
```

> nginx reads its config from a bind-mounted file, so no image rebuild is needed — just a restart.

### 12.6 Update the domain name in the nginx SSL config

```bash
nano /opt/ata/deploy/nginx.conf
```

Replace every occurrence of `atasportslive.com` with `hatasportslive.com`. Save and exit.

### 12.7 Restart nginx

```bash
docker compose start nginx
```

Test HTTPS:

```bash
curl -I https://hatasportslive.com
# Should return: HTTP/2 200
```

Open your browser and visit `https://hatasportslive.com` — you should see the padlock icon. ✓

### 12.8 Set up automatic SSL renewal

```bash
crontab -e
```

Add this line:

```cron
# Renew SSL on the 1st and 15th of every month at 3 AM
0 3 1,15 * * /opt/ata/deploy/renew-ssl.sh >> /var/log/ata-ssl-renew.log 2>&1
```

---

## Deploying future updates

Every time you make changes on Replit:

**On Replit:**
```bash
git add -A
git commit -m "describe what changed"
git push origin main
```

**On the server:**
```bash
ssh root@45.79.219.243
cd /opt/ata
./deploy/backup.sh          # always back up first
git pull origin main
docker compose build
docker compose up -d
docker compose ps           # confirm all services are Up
```

---

## Day-to-day commands

```bash
# View live logs
docker compose logs -f          # all services
docker compose logs -f api      # API only
docker compose logs -f nginx    # nginx only

# Restart a single service
docker compose restart api
docker compose restart nginx

# Open a database shell
docker compose exec db psql -U ata_user -d ata_db

# Manual backup right now
/opt/ata/deploy/backup.sh
ls -lh /opt/ata/backups/

# Stop everything
docker compose down
```

---

## Troubleshooting

| Problem | What to do |
|---------|------------|
| Site not loading | `docker compose ps` — is nginx `Up`? Check `ufw status` — is port 80 open? |
| API errors | `docker compose logs api --tail=50` |
| Database errors | `docker compose logs db --tail=50` — is it `(healthy)`? |
| WebSocket disconnects | Check `ufw status` — ports 80 and 443 must be open |
| Build fails | `docker compose build --no-cache` to force a clean rebuild |
| `git pull` asks for password | Use a Personal Access Token, not your GitHub password |
| Certbot fails — port 80 in use | `docker compose stop nginx` then retry certbot |
| Certbot fails — domain not found | DNS hasn't propagated yet — check dnschecker.org and wait |
| Backup email not arriving | Check spam; run `python3 /opt/ata/deploy/notify-backup.py` and watch for errors |
| Gateway settings missing | Check **Admin → Settings** — they came from `dt.sql`; if missing, re-enter manually |
