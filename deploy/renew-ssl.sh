#!/bin/bash
# =============================================================================
# ATA Platform — SSL Certificate Auto-Renewal
# Runs via host cron. Schedule: twice monthly (1st and 15th at 03:00 AM)
#   0 3 1,15 * * /opt/ata/deploy/renew-ssl.sh >> /var/log/ata-ssl-renew.log 2>&1
# =============================================================================
set -euo pipefail

APP_DIR="/opt/ata"
LOGFILE="/var/log/ata-ssl-renew.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOGFILE"
}

log "SSL renewal check started"

cd "$APP_DIR"

# Always restart nginx when this script exits — even if certbot fails.
# This prevents the site from staying down due to a transient certbot error.
trap 'log "Restarting nginx..."; docker compose start nginx; log "nginx restarted."' EXIT

# Stop nginx to free port 80 for the standalone challenge
log "Stopping nginx..."
docker compose stop nginx

# Attempt renewal (only renews if cert expires within 30 days)
log "Running certbot renew..."
certbot renew --standalone --non-interactive --quiet

log "SSL renewal check complete"
