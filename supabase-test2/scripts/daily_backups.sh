#!/bin/bash

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$HOME/supabase-test2/backups/daily"
WAL_ARCHIVE="$HOME/supabase-test2/wal_archive"

echo "========================================="
echo "Daily backup started at: $TIMESTAMP"
echo "========================================="

# 1. pg_dump snapshot
echo "[1/3] Taking pg_dump snapshot..."
docker exec ram_postgres pg_dump -U ram ramdb | \
  gzip > "$BACKUP_DIR/snapshot_$TIMESTAMP.sql.gz"
echo "      Saved: snapshot_$TIMESTAMP.sql.gz"

# 2. Base backup for PITR
echo "[2/3] Taking base backup..."
docker exec ram_postgres pg_basebackup \
  -U ram \
  -D /tmp/basebackup_$TIMESTAMP \
  -Ft -Xs -P

docker cp ram_postgres:/tmp/basebackup_$TIMESTAMP \
  "$BACKUP_DIR/basebackup_$TIMESTAMP"

docker exec ram_postgres \
  rm -rf /tmp/basebackup_$TIMESTAMP

echo "      Saved: basebackup_$TIMESTAMP"

# 3. Cleanup old backups (keep last 7 days)
echo "[3/3] Cleaning up backups older than 7 days..."
find "$BACKUP_DIR" -name "snapshot_*.sql.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "basebackup_*" -mtime +7 -type d -exec rm -rf {} +

echo "========================================="
echo "Backup complete: $(date '+%Y-%m-%d %H:%M:%S')"
echo "WAL archive size: $(du -sh $WAL_ARCHIVE | cut -f1)"
echo "Backup dir size:  $(du -sh $BACKUP_DIR | cut -f1)"
echo "========================================="
