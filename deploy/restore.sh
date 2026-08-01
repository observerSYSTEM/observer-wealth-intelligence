#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: deploy/restore.sh /path/to/observer-backup.tar.gz [options]

Options:
  --verify-only       Verify archive structure and checksums, then exit.
  --dry-run           Print restore actions without writing database or files.
  --database-only     Restore only PostgreSQL dump.
  --files-only        Restore only receipts, assets, vault and OCR files.
  --confirm-restore   Required for any non-dry-run restore.
EOF
}

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

ARCHIVE=""
VERIFY_ONLY=false
DRY_RUN=false
DATABASE_ONLY=false
FILES_ONLY=false
CONFIRM_RESTORE=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --verify-only) VERIFY_ONLY=true ;;
    --dry-run) DRY_RUN=true ;;
    --database-only) DATABASE_ONLY=true ;;
    --files-only) FILES_ONLY=true ;;
    --confirm-restore) CONFIRM_RESTORE=true ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      usage
      exit 2
      ;;
    *)
      if [ -n "$ARCHIVE" ]; then
        usage
        exit 2
      fi
      ARCHIVE="$1"
      ;;
  esac
  shift
done

if [ -z "$ARCHIVE" ]; then
  usage
  exit 2
fi

if [ "$DATABASE_ONLY" = "true" ] && [ "$FILES_ONLY" = "true" ]; then
  echo "--database-only and --files-only cannot be combined" >&2
  exit 2
fi

deploy/verify-backup.sh "$ARCHIVE"

if [ "$VERIFY_ONLY" = "true" ]; then
  exit 0
fi

WORKDIR="$(mktemp -d)"
cleanup() {
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

while IFS= read -r entry; do
  case "$entry" in
    /*|../*|*/../*)
      echo "Unsafe archive entry: $entry" >&2
      exit 1
      ;;
  esac
done < <(tar -tzf "$ARCHIVE")

tar -xzf "$ARCHIVE" -C "$WORKDIR"
ROOT="$(find "$WORKDIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"

set -a
[ -f .env ] && . ./.env
set +a

POSTGRES_DB="${POSTGRES_DB:-observer_wealth}"
POSTGRES_USER="${POSTGRES_USER:-observer}"
RECEIPT_STORAGE_PATH="${RECEIPT_STORAGE_PATH:-data/receipts}"
ASSET_STORAGE_PATH="${ASSET_STORAGE_PATH:-data/assets}"
VAULT_STORAGE_PATH="${VAULT_STORAGE_PATH:-data/vault}"
OCR_STORAGE_PATH="${OCR_STORAGE_PATH:-data/ocr}"

if [ "$DRY_RUN" = "true" ]; then
  echo "Would restore from: $ARCHIVE"
  [ "$FILES_ONLY" != "true" ] && echo "Would restore PostgreSQL database: $POSTGRES_DB"
  [ "$DATABASE_ONLY" != "true" ] && echo "Would restore storage folders into data/"
  exit 0
fi

if [ "$CONFIRM_RESTORE" != "true" ]; then
  echo "Restore refused. Re-run with --confirm-restore or --dry-run." >&2
  exit 2
fi

copy_tree() {
  local source="$1"
  local destination="$2"
  if [ -d "$source" ]; then
    mkdir -p "$destination"
    cp -a "$source"/. "$destination"/
  fi
}

if [ "$FILES_ONLY" != "true" ]; then
  docker compose cp "$ROOT/observer-wealth.dump" db:/tmp/observer-wealth-restore.dump
  docker compose exec -T db pg_restore \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --clean \
    --if-exists \
    --no-owner \
    "/tmp/observer-wealth-restore.dump"
  docker compose exec -T db rm -f /tmp/observer-wealth-restore.dump
fi

if [ "$DATABASE_ONLY" != "true" ]; then
  copy_tree "$ROOT/receipts" "$RECEIPT_STORAGE_PATH"
  copy_tree "$ROOT/assets" "$ASSET_STORAGE_PATH"
  copy_tree "$ROOT/vault" "$VAULT_STORAGE_PATH"
  copy_tree "$ROOT/ocr" "$OCR_STORAGE_PATH"
fi

echo "Restore completed from $ARCHIVE"
