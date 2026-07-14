#!/bin/sh
# Nightly backup: local Postgres dump + uploads archive, retained 14 days.
set -eu

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="/backups"
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"

# 1) Database — prefer internal Docker connection (PGHOST), fall back to DATABASE_URL.
if [ -n "${PGHOST:-}" ] && [ -n "${PGPASSWORD:-}" ]; then
  echo "[backup] dumping database from ${PGHOST}..."
  pg_dump -h "$PGHOST" -U "${PGUSER:-azc}" "${PGDATABASE:-az_erp}" | gzip > "$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"
elif [ -n "${DATABASE_URL:-}" ]; then
  echo "[backup] dumping database via DATABASE_URL..."
  pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"
else
  echo "[backup] WARNING: no database connection configured, skipping DB dump"
fi

# 2) Uploaded documents.
if [ -d /data/uploads ]; then
  echo "[backup] archiving uploads..."
  tar -czf "$BACKUP_DIR/uploads_${TIMESTAMP}.tar.gz" -C /data uploads
fi

# 3) Retention.
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "[backup] done: $TIMESTAMP"
