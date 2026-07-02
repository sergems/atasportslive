#!/usr/bin/env python3
"""
ATA Platform — Weekly Backup Email Notification
Sends an email to info@atasportslive.com every Monday with details of the
latest backup file and instructions to download it.

Schedule: every Monday at 08:00 AM  →  0 8 * * 1 python3 /opt/ata/deploy/notify-backup.py

Required environment variables (set in /opt/ata/.env):
  SMTP_HOST     — SMTP server hostname  (e.g. smtp.gmail.com)
  SMTP_PORT     — SMTP port             (e.g. 587)
  SMTP_USER     — SMTP login username   (e.g. yourname@gmail.com)
  SMTP_PASS     — SMTP password / App Password
  NOTIFY_EMAIL  — recipient address     (e.g. info@atasportslive.com)
"""

import os
import glob
import smtplib
import sys
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path

# ---------------------------------------------------------------------------
# Load .env file from the app directory
# ---------------------------------------------------------------------------
ENV_FILE = "/opt/ata/.env"
env = {}
if os.path.exists(ENV_FILE):
    with open(ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                env[key.strip()] = val.strip()

def get(key):
    return os.environ.get(key) or env.get(key) or ""

SMTP_HOST    = get("SMTP_HOST")
SMTP_PORT    = int(get("SMTP_PORT") or "587")
SMTP_USER    = get("SMTP_USER")
SMTP_PASS    = get("SMTP_PASS")
NOTIFY_EMAIL = get("NOTIFY_EMAIL") or "info@atasportslive.com"

BACKUP_DIR = "/opt/ata/backups"
SERVER_IP  = "173.230.131.210"

# ---------------------------------------------------------------------------
# Find the most recent backup
# ---------------------------------------------------------------------------
backups = sorted(glob.glob(f"{BACKUP_DIR}/*.sql.gz"), reverse=True)

if not backups:
    print(f"[{datetime.now()}] No backups found — skipping notification.")
    sys.exit(0)

latest       = backups[0]
latest_name  = os.path.basename(latest)
latest_size  = f"{os.path.getsize(latest) / (1024*1024):.1f} MB"
latest_mtime = datetime.fromtimestamp(os.path.getmtime(latest)).strftime("%Y-%m-%d %H:%M UTC")

all_backups_text = "\n".join(
    f"  • {os.path.basename(b)}  ({os.path.getsize(b)/(1024*1024):.1f} MB)"
    for b in backups
)

# ---------------------------------------------------------------------------
# Build the email
# ---------------------------------------------------------------------------
subject = f"[ATA Platform] Weekly Backup Ready — {datetime.now().strftime('%Y-%m-%d')}"

body = f"""
Hello,

Your weekly ATA Platform database backup report is ready.

─────────────────────────────────────────
  Latest backup
─────────────────────────────────────────
  File   : {latest_name}
  Size   : {latest_size}
  Created: {latest_mtime}

─────────────────────────────────────────
  All stored backups (last 2 kept)
─────────────────────────────────────────
{all_backups_text}

─────────────────────────────────────────
  How to download the backup
─────────────────────────────────────────
Run this command from your local machine:

  scp root@{SERVER_IP}:{latest} ./

Or connect via SSH and inspect the backups folder:

  ssh root@{SERVER_IP}
  ls -lh /opt/ata/backups/

─────────────────────────────────────────
  How to restore a backup
─────────────────────────────────────────
  cd /opt/ata
  gunzip -c backups/{latest_name} | \\
    docker compose exec -T db psql -U ata_user ata_db

─────────────────────────────────────────

This is an automated message from the ATA Platform backup system.
Server: {SERVER_IP}
""".strip()

msg = MIMEMultipart("alternative")
msg["Subject"] = subject
msg["From"]    = SMTP_USER
msg["To"]      = NOTIFY_EMAIL
msg.attach(MIMEText(body, "plain"))

# ---------------------------------------------------------------------------
# Send via SMTP
# ---------------------------------------------------------------------------
if not all([SMTP_HOST, SMTP_USER, SMTP_PASS]):
    print(f"[{datetime.now()}] SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env")
    sys.exit(1)

try:
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_USER, NOTIFY_EMAIL, msg.as_string())
    print(f"[{datetime.now()}] Notification sent to {NOTIFY_EMAIL}")
except Exception as e:
    print(f"[{datetime.now()}] Failed to send email: {e}")
    sys.exit(1)
