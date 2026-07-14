#!/bin/sh
# Restore a database dump and/or uploads archive produced by backup.sh.
#
#   sh deploy/restore.sh db_20260713_020000.sql.gz uploads_20260713_020000.tar.gz
set -eu

DB_FILE="${1:-}"
UPLOADS_FILE="${2:-}"
BACKUP_DIR="./backups"

if [ -n "$DB_FILE" ]; then
  echo "[restore] restoring database from $DB_FILE ..."
  gunzip -c "$BACKUP_DIR/$DB_FILE" | psql "$DATABASE_URL"
fi

if [ -n "$UPLOADS_FILE" ]; then
  echo "[restore] restoring uploads from $UPLOADS_FILE ..."
  tar -xzf "$BACKUP_DIR/$UPLOADS_FILE" -C ./
fi

echo "[restore] done."
