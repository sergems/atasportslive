#!/bin/bash
# =============================================================================
# ATA Platform — Daily Database Backup
# Runs via host cron. Keeps the last 2 backups only.
# Schedule: daily at 02:00 AM  →  0 2 * * * /opt/ata/deploy/backup.sh
# =============================================================================
set -euo pipefail

APP_DIR="/opt/ata"
BACKUP_DIR="$APP_DIR/backups"
LOGFILE="/var/log/ata-backup.log"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/ata_backup_$TIMESTAMP.sql.gz"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOGFILE"
}

# ---- ensure backup directory exists ----------------------------------------
mkdir -p "$BACKUP_DIR"

# ---- dump the database from the running container --------------------------
log "Starting backup → $BACKUP_FILE"

cd "$APP_DIR"
docker compose exec -T db pg_dump \
  -U ata_user \
  ata_db | gzip > "$BACKUP_FILE"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
log "Backup complete: $BACKUP_FILE ($SIZE)"

# ---- keep only the last 2 backups ------------------------------------------
EXCESS=$(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n +3)
if [ -n "$EXCESS" ]; then
  echo "$EXCESS" | xargs rm -f
  log "Old backups removed (keeping last 2)"
fi

log "Done."
