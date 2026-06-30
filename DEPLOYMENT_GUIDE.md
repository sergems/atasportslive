# ATA Platform — Linode Deployment Guide

**Server IP:** `173.230.131.210`  
**Future domain:** `https://atasportslive.com`  
**Stack:** Node.js 24 · pnpm 11.8.0 · Express 5 · PostgreSQL 16 · nginx · Docker

---

## Overview

The app runs as three Docker containers managed by Docker Compose:

| Container | Role | Port |
|-----------|------|------|
| `db`      | PostgreSQL 16-alpine database | internal only |
| `api`     | Node.js / Express API server | internal `8080` |
| `nginx`   | Reverse proxy + frontend static files | `80` (public) |

nginx is the only container exposed to the internet. It serves the built React frontend directly and proxies `/api`, `/ws`, and `/uploads` to the API container.

---

## Part 1 — First-time Server Setup

### 1.1 SSH into your Linode

```bash
ssh root@173.230.131.210
```

### 1.2 Update the system

```bash
apt-get update && apt-get upgrade -y
```

### 1.3 Install Docker Engine

```bash
curl -fsSL https://get.docker.com | sh
```

Verify it installed correctly:

```bash
docker --version
# Docker version 27.x.x
```

### 1.4 Install Docker Compose plugin

```bash
apt-get install -y docker-compose-plugin
docker compose version
# Docker Compose version v2.x.x
```

### 1.5 (Optional but recommended) Create a non-root user

```bash
adduser ata
usermod -aG docker ata
su - ata
```

---

## Part 2 — Upload the Project

### Option A — Git clone (recommended)

If your code is on GitHub/GitLab:

```bash
git clone https://github.com/YOUR_USERNAME/ata-platform.git /opt/ata
cd /opt/ata
```

### Option B — Upload with scp (from your local machine)

Run this **on your local machine** (not on the server):

```bash
# Upload the entire project folder
scp -r /path/to/ata-platform root@173.230.131.210:/opt/ata
```

Then on the server:

```bash
cd /opt/ata
```

---

## Part 3 — Configure Environment Variables

### 3.1 Create the `.env` file

```bash
cp deploy/.env.example .env
nano .env
```

Fill in strong, random values:

```env
POSTGRES_PASSWORD=replace_with_a_long_random_password
SESSION_SECRET=replace_with_a_long_random_secret
```

**Generate secure values:**

```bash
# Generate POSTGRES_PASSWORD
openssl rand -base64 32

# Generate SESSION_SECRET
openssl rand -base64 64
```

> ⚠️ Never share or commit the `.env` file. Keep it on the server only.

### 3.2 Secure the `.env` file

```bash
chmod 600 .env
```

---

## Part 4 — Build and Start the Containers

### 4.1 Build Docker images

This compiles the TypeScript API server, builds the React frontend, and assembles the nginx image. It takes **3–6 minutes** on first run.

```bash
docker compose build
```

### 4.2 Start the database first

```bash
docker compose up -d db
```

Wait for it to become healthy:

```bash
docker compose ps
# db should show "(healthy)"
```

### 4.3 Restore your database from backup

Copy your `backup.sql` to the server (if not already there):

```bash
# From your local machine:
scp backup.sql root@173.230.131.210:/opt/ata/backup.sql
```

Then restore it into the running postgres container:

```bash
# Load the backup into the database
docker compose exec -T db psql \
  -U ata_user \
  -d ata_db \
  < backup.sql
```

Verify the data loaded:

```bash
docker compose exec db psql -U ata_user -d ata_db \
  -c "SELECT COUNT(*) FROM users;"
```

You should see your user count (e.g., `5031`).

### 4.4 Start all services

```bash
docker compose up -d
```

Check all containers are running:

```bash
docker compose ps
```

Expected output:

```
NAME        IMAGE       STATUS          PORTS
ata-api     ...         Up              
ata-db      ...         Up (healthy)    
ata-nginx   ...         Up              0.0.0.0:80->80/tcp
```

---

## Part 5 — Verify the Deployment

### 5.1 Test in a browser

Open: **http://173.230.131.210**

You should see the ATA Platform home page.

### 5.2 Test the API

```bash
curl http://173.230.131.210/api/streams
# Should return JSON with stream data
```

### 5.3 Check container logs

```bash
# All services
docker compose logs -f

# Just the API server
docker compose logs -f api

# Just nginx
docker compose logs -f nginx
```

---

## Part 6 — Add a Domain Name (atasportslive.com)

Once your domain is registered and pointed at `173.230.131.210`, follow these steps.

### 6.1 Point DNS to the server

In your domain registrar's DNS settings, add:

| Type | Name | Value |
|------|------|-------|
| `A` | `@` | `173.230.131.210` |
| `A` | `www` | `173.230.131.210` |

Wait for DNS to propagate (usually 5–30 minutes, up to 48 hours).

### 6.2 Install Certbot

```bash
apt-get install -y certbot python3-certbot-nginx
```

### 6.3 Stop nginx temporarily to issue the certificate

```bash
docker compose stop nginx
```

### 6.4 Obtain the SSL certificate

```bash
certbot certonly --standalone \
  -d atasportslive.com \
  -d www.atasportslive.com \
  --email your@email.com \
  --agree-tos \
  --non-interactive
```

Certificates will be saved to:
- `/etc/letsencrypt/live/atasportslive.com/fullchain.pem`
- `/etc/letsencrypt/live/atasportslive.com/privkey.pem`

### 6.5 Copy certificates to the deploy/ssl folder

```bash
mkdir -p /opt/ata/deploy/ssl
cp /etc/letsencrypt/live/atasportslive.com/fullchain.pem /opt/ata/deploy/ssl/
cp /etc/letsencrypt/live/atasportslive.com/privkey.pem  /opt/ata/deploy/ssl/
chmod 600 /opt/ata/deploy/ssl/privkey.pem
```

### 6.6 Update nginx.conf for HTTPS

Replace the contents of `deploy/nginx.conf` with:

```nginx
# Redirect HTTP → HTTPS
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

### 6.7 Rebuild nginx and restart

```bash
docker compose build nginx
docker compose up -d nginx
```

### 6.8 Set up automatic certificate renewal

```bash
crontab -e
```

Add this line:

```
0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/atasportslive.com/fullchain.pem /opt/ata/deploy/ssl/ && cp /etc/letsencrypt/live/atasportslive.com/privkey.pem /opt/ata/deploy/ssl/ && docker compose -f /opt/ata/docker-compose.yml restart nginx
```

---

## Part 7 — Updating the App

When you push new code changes:

```bash
cd /opt/ata

# Pull latest code (if using git)
git pull

# Rebuild images (only changed layers rebuild — fast)
docker compose build

# Restart services with zero-downtime rollover
docker compose up -d
```

---

## Part 8 — Useful Operations

### View real-time logs

```bash
docker compose logs -f api
docker compose logs -f nginx
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

### Back up the database

```bash
docker compose exec db pg_dump -U ata_user ata_db > backup_$(date +%Y%m%d).sql
```

### Stop everything

```bash
docker compose down
```

### Stop and wipe the database volume (⚠️ destructive)

```bash
docker compose down -v
```

---

## Part 9 — Firewall Configuration (recommended)

Allow only the ports you need:

```bash
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS (when domain is ready)
ufw enable
ufw status
```

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Site not loading | `docker compose ps` — is nginx Up? |
| API errors | `docker compose logs api` |
| Database errors | `docker compose logs db` — is it healthy? |
| WebSocket not connecting | Ensure port 80/443 is open in firewall |
| Build fails | Run `docker compose build --no-cache` to force a clean build |
| Permission denied on .env | Run `chmod 600 .env` |

---

## File Structure Summary

```
/opt/ata/
├── Dockerfile              ← Multi-stage Docker build
├── docker-compose.yml      ← Orchestrates all 3 services
├── .dockerignore           ← Speeds up Docker builds
├── .env                    ← Secrets (never commit this)
├── deploy/
│   ├── nginx.conf          ← nginx reverse proxy config
│   ├── .env.example        ← Template for .env
│   └── ssl/                ← SSL certificates (added later)
└── backup.sql              ← Database backup for restore
```
