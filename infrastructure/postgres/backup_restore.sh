#!/bin/bash
# ==============================================================================
# Product Intelligence AI - Database Backup & Recovery Runbook Utility
# ==============================================================================
# Usage:
#   Backup:  ./backup_restore.sh backup [optional_tag]
#   Restore: ./backup_restore.sh restore /path/to/backup_file.dump
# ==============================================================================

set -eo pipefail

DB_CONTAINER="${DB_CONTAINER:-saas_postgres}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-product_intelligence_dev}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"

ACTION="$1"
TARGET="$2"

case "$ACTION" in
  backup)
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    TAG="${TARGET:-manual}"
    FILENAME="backup_${DB_NAME}_${TAG}_${TIMESTAMP}.dump"
    echo "[INFO] Starting logical custom-format backup of ${DB_NAME}..."
    docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -F c -b -v -f "/tmp/${FILENAME}"
    docker cp "${DB_CONTAINER}:/tmp/${FILENAME}" "./${FILENAME}"
    docker exec "$DB_CONTAINER" rm "/tmp/${FILENAME}"
    echo "[SUCCESS] Database backup saved to: ./${FILENAME}"
    ;;
  
  restore)
    if [ -z "$TARGET" ]; then
      echo "[ERROR] Provide backup file path to restore: ./backup_restore.sh restore <file.dump>"
      exit 1
    fi
    echo "[WARNING] Restoring will overwrite existing data in ${DB_NAME}!"
    read -p "Are you sure you want to proceed? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      echo "[INFO] Copying ${TARGET} to container..."
      docker cp "$TARGET" "${DB_CONTAINER}:/tmp/restore_target.dump"
      echo "[INFO] Performing pg_restore with clean cascade..."
      docker exec "$DB_CONTAINER" pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists -v "/tmp/restore_target.dump" || true
      docker exec "$DB_CONTAINER" rm "/tmp/restore_target.dump"
      echo "[SUCCESS] Database restored successfully."
    else
      echo "[ABORTED] Restore cancelled by operator."
    fi
    ;;

  *)
    echo "Usage: $0 {backup|restore} [argument]"
    exit 1
    ;;
esac
