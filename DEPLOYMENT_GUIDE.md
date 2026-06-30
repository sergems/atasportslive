# ATA Platform — Deployment Guide

**GitHub repo:** `https://github.com/sergems/atasportslive`  
**Server IP:** `173.230.131.210`  
**Future domain:** `https://atasportslive.com`  
**Stack:** Node.js 24 · pnpm 11.8.0 · Express 5 · PostgreSQL 16 · nginx · Docker

---

## How it works

```
Your computer  →  GitHub  →  Linode server
   (code)        (repo)      (Docker containers)
```

Every deployment follows the same loop:
1. Make changes on your computer
2. Push to GitHub
3. SSH into the Linode server and pull + redeploy

The server runs three Docker containers:

| Container | Role | Exposed |
|-----------|------|---------|
| `db`      | PostgreSQL 16 — stores all data | No (internal only) |
| `api`     | Node.js / Express API + WebSocket | No (internal only) |
| `nginx`   | Serves frontend + proxies API | Yes — port 80 / 443 |

---

## Part 1 — Push your code to GitHub

Do this once from your computer before touching the server.

### 1.1 Make sure Git is set up locally

```bash
git config --global user.name  "Your Name"
git config --global user.email "your@email.com"
```

### 1.2 Initialise the repo and push

```bash
cd /path/to/your/ata-platform   # your project folder on your computer

git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/sergems/atasportslive.git
git push -u origin main
```

> If GitHub asks for credentials, enter your GitHub username and a **Personal Access Token** (not your password).  
> Create one at: **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**  
> Give it the `repo` scope.

### 1.3 Add a `.gitignore` (if not already present)

Make sure these lines are in `.gitignore` so secrets and build files are never committed:

```
.env
node_modules
**/dist
backup.sql
deploy/ssl/
```

---

## Part 2 — First-time Linode server setup

SSH into the server:

```bash
ssh root@173.230.131.210
```

### 2.1 Update the system

```bash
apt-get update && apt-get upgrade -y
```

### 2.2 Install Git

```bash
apt-get install -y git
```

### 2.3 Install Docker Engine

```bash
curl -fsSL https://get.docker.com | sh
```

Verify:

```bash
docker --version
# Docker version 27.x.x
```

### 2.4 Install Docker Compose plugin

```bash
apt-get install -y docker-compose-plugin
docker compose version
# Docker Compose version v2.x.x
```

### 2.5 Set up a firewall

```bash
apt-get install -y ufw
ufw allow 22     # SSH
ufw allow 80     # HTTP
ufw allow 443    # HTTPS (for when the domain is ready)
ufw enable
ufw status
```

---

## Part 3 — Clone the repo onto the server

```bash
git clone https://github.com/sergems/atasportslive.git /opt/ata
cd /opt/ata
```

---

## Part 4 — Configure environment variables

### 4.1 Create the `.env` file

```bash
cp deploy/.env.example .env
nano .env
```

Fill in every value. Here is what each one means:

| Variable | Description | How to generate |
|----------|-------------|-----------------|
| `POSTGRES_PASSWORD` | PostgreSQL database password | `openssl rand -base64 32` |
| `SESSION_SECRET` | JWT signing secret | `openssl rand -base64 64` |
| `SMTP_HOST` | Your email SMTP server | See §4.2 below |
| `SMTP_PORT` | SMTP port (usually 587) | See §4.2 below |
| `SMTP_USER` | SMTP login email address | See §4.2 below |
| `SMTP_PASS` | SMTP password or App Password | See §4.2 below |
| `NOTIFY_EMAIL` | Where weekly backup emails go | `info@atasportslive.com` |

**Generate secure values right now:**

```bash
# Copy these outputs into your .env
openssl rand -base64 32   # → POSTGRES_PASSWORD
openssl rand -base64 64   # → SESSION_SECRET
```

### 4.2 Setting up Gmail SMTP (recommended)

If you want to send the weekly backup notification from a Gmail account:

1. Go to **myaccount.google.com → Security → 2-Step Verification** and turn it ON  
2. Then go to **myaccount.google.com/apppasswords**  
3. Create an App Password called "ATA Backup"  
4. Copy the 16-character password it gives you  

Use these values in `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourname@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx    ← the 16-char App Password
NOTIFY_EMAIL=info@atasportslive.com
```

### 4.3 Lock down the `.env` file

```bash
chmod 600 /opt/ata/.env
```

---

## Part 5 — Build and start the app

### 5.1 Build Docker images

This downloads Node.js, compiles TypeScript, builds the React frontend, and sets up nginx. Takes **3–6 minutes** on first run.

```bash
cd /opt/ata
docker compose build
```

### 5.2 Start the database

```bash
docker compose up -d db
```

Wait until it shows `(healthy)`:

```bash
watch docker compose ps
# Press Ctrl+C when db shows "(healthy)"
```

### 5.3 Restore your database from backup

Copy your `backup.sql` from your local machine to the server:

```bash
# Run this on YOUR LOCAL COMPUTER (not on the server):
scp /path/to/backup.sql root@173.230.131.210:/opt/ata/backup.sql
```

Then on the **server**, restore it:

```bash
cd /opt/ata
docker compose exec -T db psql -U ata_user -d ata_db < backup.sql
```

Verify the data loaded:

```bash
docker compose exec db psql -U ata_user -d ata_db \
  -c "SELECT COUNT(*) FROM users;"
# Should show your user count, e.g. 5031
```

### 5.4 Start all services

```bash
docker compose up -d
```

Check everything is running:

```bash
docker compose ps
```

Expected output:

```
NAME        STATUS          PORTS
ata-api     Up              
ata-db      Up (healthy)    
ata-nginx   Up              0.0.0.0:80->80/tcp
```

### 5.5 Test it in a browser

Open: **http://173.230.131.210**

You should see the ATA Platform home page.

---

## Part 6 — Set up automatic database backups

Backups run daily at 2 AM, keep only the 2 most recent copies, and email a notification to `info@atasportslive.com` every Monday at 8 AM.

### 6.1 Make the scripts executable

```bash
chmod +x /opt/ata/deploy/backup.sh
chmod +x /opt/ata/deploy/notify-backup.py
```

### 6.2 Create the backups folder

```bash
mkdir -p /opt/ata/backups
```

### 6.3 Test the backup script manually

```bash
/opt/ata/deploy/backup.sh
```

You should see output like:

```
[2026-06-30 02:00:01] Starting backup → /opt/ata/backups/ata_backup_20260630_020001.sql.gz
[2026-06-30 02:00:05] Backup complete: ata_backup_20260630_020001.sql.gz (4.2 MB)
[2026-06-30 02:00:05] Done.
```

### 6.4 Test the email notification manually

```bash
python3 /opt/ata/deploy/notify-backup.py
```

Check `info@atasportslive.com` — you should receive a notification email within a minute.

### 6.5 Schedule both with cron

```bash
crontab -e
```

Add these two lines at the bottom:

```cron
# Daily database backup at 02:00 AM — keeps last 2 copies
0 2 * * * /opt/ata/deploy/backup.sh >> /var/log/ata-backup.log 2>&1

# Weekly email notification every Monday at 08:00 AM
0 8 * * 1 python3 /opt/ata/deploy/notify-backup.py >> /var/log/ata-backup.log 2>&1
```

Save and exit (in nano: `Ctrl+O`, `Enter`, `Ctrl+X`).

Verify cron is active:

```bash
crontab -l
```

### 6.6 View backup logs

```bash
tail -f /var/log/ata-backup.log
```

---

## Part 7 — Add a domain name (atasportslive.com)

When your domain `atasportslive.com` is registered, follow these steps.

### 7.1 Point DNS to the server

In your domain registrar's DNS panel, add these records:

| Type | Name  | Value              | TTL  |
|------|-------|--------------------|------|
| `A`  | `@`   | `173.230.131.210`  | 3600 |
| `A`  | `www` | `173.230.131.210`  | 3600 |

Wait for DNS to propagate (usually 5–30 minutes, up to 48 hours). Test with:

```bash
ping atasportslive.com
# Should resolve to 173.230.131.210
```

### 7.2 Get a free SSL certificate (HTTPS)

```bash
apt-get install -y certbot

# Stop nginx temporarily so certbot can use port 80
docker compose stop nginx

# Issue the certificate
certbot certonly --standalone \
  -d atasportslive.com \
  -d www.atasportslive.com \
  --email info@atasportslive.com \
  --agree-tos \
  --non-interactive
```

### 7.3 Copy certificates to the project

```bash
mkdir -p /opt/ata/deploy/ssl

cp /etc/letsencrypt/live/atasportslive.com/fullchain.pem /opt/ata/deploy/ssl/
cp /etc/letsencrypt/live/atasportslive.com/privkey.pem   /opt/ata/deploy/ssl/
chmod 600 /opt/ata/deploy/ssl/privkey.pem
```

### 7.4 Switch nginx to HTTPS

Replace `deploy/nginx.conf` with:

```nginx
server {
    listen 80;
    server_name atasportslive.com www.atasportslive.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name atasportslive.com www.atasportslive.com;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 50M;

    root  /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location /api/ {
        proxy_pass         http://api:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    location /ws {
        proxy_pass         http://api:8080;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       $host;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    location /uploads/ {
        proxy_pass         http://api:8080;
        proxy_set_header   Host            $host;
        expires            7d;
        add_header         Cache-Control "public";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 7.5 Rebuild nginx and restart

```bash
cd /opt/ata
docker compose build nginx
docker compose up -d nginx
```

Test HTTPS:

```bash
curl -I https://atasportslive.com
# Should return HTTP/2 200
```

### 7.6 Auto-renew SSL certificates

SSL certificates expire every 90 days. Add this to cron to auto-renew:

```bash
crontab -e
```

Add this line:

```cron
# Renew SSL certificate on the 1st of every month at 3 AM
0 3 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/atasportslive.com/fullchain.pem /opt/ata/deploy/ssl/ && cp /etc/letsencrypt/live/atasportslive.com/privkey.pem /opt/ata/deploy/ssl/ && docker compose -f /opt/ata/docker-compose.yml restart nginx
```

---

## Part 8 — Admin configuration after first launch

Once the platform is live (§5.5), log into the admin panel and configure these settings before sharing the link with users.

### 8.1 Log in as admin

Open **http://173.230.131.210** (or your domain once set up) and sign in:

- **Email:** `admin@ata.ug`
- **Password:** `admin123` ← **change this immediately** (Profile → Change Password)

### 8.2 Configure payment gateways

Go to **Admin → Settings** and scroll to the payment gateway cards.

#### Pesapal (card payments, MoMo, USSD)

| Field | Where to get it |
|-------|----------------|
| Consumer Key | Pesapal merchant dashboard → API credentials |
| Consumer Secret | Pesapal merchant dashboard → API credentials |
| Environment | Set to **Live** for production (Sandbox for testing) |
| Currency | `UGX` (or your preferred settlement currency) |

Click **Save Pesapal Settings**.

#### PawaPay (instant mobile money — preferred)

| Field | Where to get it |
|-------|----------------|
| API Token | PawaPay dashboard → Developer → API Keys |
| Environment | Set to **Production** for live use (Sandbox for testing) |
| Currency | `UGX` |
| Exchange Rate | Current USD → UGX rate (e.g. `3700`) |

Click **Save PawaPay Settings**.

### 8.3 Enable / disable gateways

Each gateway card in **Admin → Settings** has a toggle switch in the top-right corner:

- **Toggle ON (coloured)** — gateway is live; users can deposit / withdraw through it
- **Toggle OFF (grey)** — gateway is suspended; the tab is greyed out on the wallet page and users cannot click it; the API returns `503` for any attempt

Use this to take a gateway offline for maintenance without touching the server — no restart needed, takes effect within 60 seconds for all users.

> **Note:** Gateway credentials and on/off state are stored in the `settings` table in the database. They survive container restarts and redeployments automatically. No environment variables are needed.

### 8.4 Test a deposit end-to-end

Before going live:

1. Log in as `demo@ata.ug` / `demo123`
2. Go to **Wallet → Deposit**
3. Try a small PawaPay deposit (sandbox mode) to confirm the mobile prompt arrives
4. Try a Pesapal initiation (sandbox) to confirm the redirect lands on Pesapal's page

---

## Part 9 — Deploying updates (after first setup)

Every time you make changes to the app:

### On your computer

```bash
# Stage and commit your changes
git add .
git commit -m "describe what you changed"

# Push to GitHub
git push origin main
```

### On the Linode server

```bash
ssh root@173.230.131.210
cd /opt/ata

# Pull latest code from GitHub
git pull origin main

# Rebuild Docker images (only changed layers rebuild — usually fast)
docker compose build

# Restart services with the new build
docker compose up -d
```

That's it. The site will be back up within 30–60 seconds.

---

## Part 10 — Useful day-to-day commands

### View live logs

```bash
docker compose logs -f          # all services
docker compose logs -f api      # API server only
docker compose logs -f nginx    # nginx only
```

### Restart a single service

```bash
docker compose restart api
docker compose restart nginx
```

### Open a database shell

```bash
docker compose exec db psql -U ata_user -d ata_db
```

### Manually trigger a backup right now

```bash
/opt/ata/deploy/backup.sh
ls -lh /opt/ata/backups/
```

### Download a backup to your local computer

```bash
# Run this on your LOCAL machine:
scp root@173.230.131.210:/opt/ata/backups/ata_backup_YYYYMMDD_HHMMSS.sql.gz ./
```

### Restore a backup

```bash
cd /opt/ata
gunzip -c backups/ata_backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose exec -T db psql -U ata_user -d ata_db
```

### Stop everything

```bash
docker compose down
```

---

## Quick reference — full file structure on the server

```
/opt/ata/
├── Dockerfile              ← Multi-stage Docker build
├── docker-compose.yml      ← Orchestrates all 3 services
├── .dockerignore
├── .env                    ← Secrets — never commit this file
├── deploy/
│   ├── nginx.conf          ← nginx reverse proxy config
│   ├── .env.example        ← Template for .env
│   ├── backup.sh           ← Daily DB backup script (cron)
│   ├── notify-backup.py    ← Weekly email notification (cron)
│   └── ssl/                ← SSL certificates (added when domain is ready)
│       ├── fullchain.pem
│       └── privkey.pem
└── backups/                ← Backup files (last 2 kept automatically)
    ├── ata_backup_20260701_020001.sql.gz
    └── ata_backup_20260702_020001.sql.gz
```

---

## Troubleshooting

| Problem | What to check |
|---------|---------------|
| Site not loading | `docker compose ps` — is nginx `Up`? |
| API errors (500) | `docker compose logs api` |
| Database errors | `docker compose logs db` — is it `(healthy)`? |
| WebSocket not connecting | Check firewall: `ufw status` — port 80 open? |
| Backup email not arriving | Check spam folder; run `python3 /opt/ata/deploy/notify-backup.py` manually and watch for errors |
| Build fails | `docker compose build --no-cache` to force a clean rebuild |
| `git pull` asks for password | Use a Personal Access Token, not your GitHub password |
| Permission denied `.env` | `chmod 600 /opt/ata/.env` |
| Deposit tab greyed out for all users | A gateway was disabled in Admin → Settings. Re-enable the toggle and save. |
| PawaPay deposit returns 503 | Either PawaPay is toggled off, or the API token is missing. Check Admin → Settings → PawaPay. |
| Pesapal deposit returns 503 | Either Pesapal is toggled off, or Consumer Key/Secret is missing. Check Admin → Settings → Pesapal. |
| Gateway settings lost after redeploy | Settings are stored in the `settings` DB table — they persist across restarts. If the table is missing, restore from backup (§5.3). |
