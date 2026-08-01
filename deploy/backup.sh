#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

set -a
[ -f .env ] && . ./.env
set +a

BACKUP_DIR="${BACKUP_DIR:-${BACKUP_STORAGE_PATH:-./data/backups}}"
POSTGRES_DB="${POSTGRES_DB:-observer_wealth}"
POSTGRES_USER="${POSTGRES_USER:-observer}"
RECEIPT_STORAGE_PATH="${RECEIPT_STORAGE_PATH:-data/receipts}"
ASSET_STORAGE_PATH="${ASSET_STORAGE_PATH:-data/assets}"
VAULT_STORAGE_PATH="${VAULT_STORAGE_PATH:-data/vault}"
OCR_STORAGE_PATH="${OCR_STORAGE_PATH:-data/ocr}"
BACKUP_STORAGE_PATH="${BACKUP_STORAGE_PATH:-data/backups}"
INCLUDE_SECRETS_IN_BACKUP="${INCLUDE_SECRETS_IN_BACKUP:-false}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUTPUT_DIR="${BACKUP_DIR%/}/${STAMP}"
ARCHIVE_PATH="${OUTPUT_DIR}.tar.gz"
TEMP_ARCHIVE="${ARCHIVE_PATH}.tmp"

mkdir -p "$OUTPUT_DIR"

docker compose exec -T db pg_dump \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --format custom \
  --file "/tmp/observer-wealth-${STAMP}.dump"

docker compose cp "db:/tmp/observer-wealth-${STAMP}.dump" "$OUTPUT_DIR/observer-wealth.dump"
docker compose exec -T db rm -f "/tmp/observer-wealth-${STAMP}.dump"

mkdir -p "$OUTPUT_DIR/config"
cp docker-compose.yml docker-compose.dev.yml docker-compose.prod.yml docker-compose.pi.yml "$OUTPUT_DIR/config/"
cp .env.example "$OUTPUT_DIR/config/.env.example"
cp -R database deploy docker "$OUTPUT_DIR/config/"

if [ -d "$RECEIPT_STORAGE_PATH" ]; then
  mkdir -p "$OUTPUT_DIR/receipts"
  cp -R "$RECEIPT_STORAGE_PATH"/. "$OUTPUT_DIR/receipts/"
fi

if [ -d "$ASSET_STORAGE_PATH" ]; then
  mkdir -p "$OUTPUT_DIR/assets"
  cp -R "$ASSET_STORAGE_PATH"/. "$OUTPUT_DIR/assets/"
fi

if [ -d "$VAULT_STORAGE_PATH" ]; then
  mkdir -p "$OUTPUT_DIR/vault"
  cp -R "$VAULT_STORAGE_PATH"/. "$OUTPUT_DIR/vault/"
fi

if [ -d "$OCR_STORAGE_PATH" ]; then
  mkdir -p "$OUTPUT_DIR/ocr"
  cp -R "$OCR_STORAGE_PATH"/. "$OUTPUT_DIR/ocr/"
fi

if [ "$INCLUDE_SECRETS_IN_BACKUP" = "true" ] && [ -f .env ]; then
  cp .env "$OUTPUT_DIR/config/.env"
else
  cat > "$OUTPUT_DIR/config/SECRETS_NOT_INCLUDED.txt" <<'EOF'
The .env file was intentionally excluded from this backup.
Set INCLUDE_SECRETS_IN_BACKUP=true only when writing to encrypted storage.
EOF
fi

cat > "$OUTPUT_DIR/MANIFEST.txt" <<EOF
Observer Wealth Intelligence backup
Created UTC: ${STAMP}
Includes: PostgreSQL dump, receipt files, asset files, vault files, OCR artifacts when present, non-secret deployment configuration.
Secrets included: ${INCLUDE_SECRETS_IN_BACKUP}
EOF

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$OUTPUT_DIR" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)
elif command -v shasum >/dev/null 2>&1; then
  (cd "$OUTPUT_DIR" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 shasum -a 256 > SHA256SUMS)
fi

tar -czf "$TEMP_ARCHIVE" -C "$BACKUP_DIR" "$STAMP"
tar -tzf "$TEMP_ARCHIVE" >/dev/null
mv "$TEMP_ARCHIVE" "$ARCHIVE_PATH"
rm -rf "$OUTPUT_DIR"

echo "Backup written to ${ARCHIVE_PATH}"
