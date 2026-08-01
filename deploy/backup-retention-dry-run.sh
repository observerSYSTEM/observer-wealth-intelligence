#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

set -a
[ -f .env ] && . ./.env
set +a

BACKUP_DIR="${BACKUP_DIR:-${BACKUP_STORAGE_PATH:-./data/backups}}"
RETENTION_COUNT="${BACKUP_RETENTION_COUNT:-7}"

if ! [[ "$RETENTION_COUNT" =~ ^[0-9]+$ ]] || [ "$RETENTION_COUNT" -lt 1 ]; then
  echo "BACKUP_RETENTION_COUNT must be a positive integer" >&2
  exit 2
fi

if [ ! -d "$BACKUP_DIR" ]; then
  echo "Backup directory does not exist: $BACKUP_DIR"
  exit 0
fi

mapfile -t backups < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.tar.gz' -printf '%T@ %p\n' 2>/dev/null | sort -rn | cut -d' ' -f2-)

echo "Retention dry run for $BACKUP_DIR"
echo "Keeping newest $RETENTION_COUNT shell backup archive(s)."

if [ "${#backups[@]}" -eq 0 ]; then
  echo "No shell backup archives found."
  exit 0
fi

index=0
for backup in "${backups[@]}"; do
  index=$((index + 1))
  if [ "$index" -le "$RETENTION_COUNT" ]; then
    echo "KEEP   $backup"
  else
    echo "PRUNE  $backup"
  fi
done

echo "Dry run complete. No files were deleted."
