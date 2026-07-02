# Domain Setup Guide — atasportslive.com on Linode (45.79.219.243)

This guide adds your domain to the server in two steps:
1. **HTTP only** — get the site working on `atasportslive.com` right away
2. **HTTPS (SSL)** — get a free certificate from Let's Encrypt

---

## Part 1 — Confirm your DNS is pointing to the server

Before anything else, verify your domain is pointing to `45.79.219.243`.
Run this from any terminal (your laptop, anywhere):

```bash
nslookup atasportslive.com
```

You should see `45.79.219.243` in the result. If not, log in to wherever your
domain is registered (GoDaddy, Namecheap, etc.) and set an **A record**:

| Type | Name | Value          | TTL  |
|------|------|----------------|------|
| A    | @    | 45.79.219.243  | 3600 |
| A    | www  | 45.79.219.243  | 3600 |

DNS changes can take up to 30 minutes to propagate. Once `nslookup` shows the
right IP, continue.

---

## Part 2 — Pull the latest nginx config and restart nginx

SSH into the server, then run:

```bash
cd /opt/ata
git pull origin main
docker compose restart nginx
```

Your site should now be accessible at **http://atasportslive.com** and
**http://www.atasportslive.com**.

Test it:

```bash
curl -I http://atasportslive.com
```

You should get `HTTP/1.1 200 OK`. If so, Part 2 is done.

---

## Part 3 — Install Certbot (one-time, on the server)

```bash
apt update
apt install -y certbot
```

---

## Part 4 — Get the SSL certificate

Run Certbot in standalone mode. This temporarily uses port 80, so stop nginx first:

```bash
docker compose stop nginx

certbot certonly --standalone \
  -d atasportslive.com \
  -d www.atasportslive.com \
  --agree-tos --no-eff-email \
  -m your@email.com

docker compose start nginx
```

Replace `your@email.com` with your real email address — Let's Encrypt sends
renewal reminders there.

If it succeeds you will see:

```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/atasportslive.com/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/atasportslive.com/privkey.pem
```

---

## Part 5 — Switch nginx to the HTTPS config

```bash
cd /opt/ata
cp deploy/nginx-ssl.conf deploy/nginx.conf
docker compose restart nginx
```

Your site is now live on **https://atasportslive.com**. HTTP requests are
automatically redirected to HTTPS.

Test it:

```bash
curl -I https://atasportslive.com
```

You should see `HTTP/1.1 200 OK` and a `Strict-Transport-Security` header.

---

## Part 6 — Set up automatic SSL renewal

Certbot certificates expire every 90 days. Set up a cron job to auto-renew:

```bash
crontab -e
```

Add this line at the bottom (runs renewal check twice a day):

```
0 3,15 * * * certbot renew --pre-hook "cd /opt/ata && docker compose stop nginx" --post-hook "cd /opt/ata && docker compose start nginx" --quiet
```

Save and exit (`Ctrl+X`, then `Y`, then `Enter` if using nano).

---

## Done ✓

| What                        | Where                                 |
|-----------------------------|---------------------------------------|
| HTTP (auto-redirects)       | http://atasportslive.com              |
| HTTPS (main)                | https://atasportslive.com             |
| WWW redirect                | https://www.atasportslive.com → https://atasportslive.com |
| Server IP (still works)     | http://45.79.219.243                  |
