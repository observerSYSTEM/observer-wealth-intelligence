#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

set -a
[ -f .env ] && . ./.env
set +a

BACKUP_DIR="${BACKUP_DIR:-./backups}"
POSTGRES_DB="${POSTGRES_DB:-observer_wealth}"
POSTGRES_USER="${POSTGRES_USER:-observer}"
RECEIPT_STORAGE_PATH="${RECEIPT_STORAGE_PATH:-data/receipts}"
INCLUDE_SECRETS_IN_BACKUP="${INCLUDE_SECRETS_IN_BACKUP:-false}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUTPUT_DIR="${BACKUP_DIR%/}/${STAMP}"

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
Includes: PostgreSQL dump, receipt files when present, non-secret deployment configuration.
Secrets included: ${INCLUDE_SECRETS_IN_BACKUP}
EOF

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$OUTPUT_DIR" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)
elif command -v shasum >/dev/null 2>&1; then
  (cd "$OUTPUT_DIR" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 shasum -a 256 > SHA256SUMS)
fi

tar -czf "${OUTPUT_DIR}.tar.gz" -C "$BACKUP_DIR" "$STAMP"
tar -tzf "${OUTPUT_DIR}.tar.gz" >/dev/null
rm -rf "$OUTPUT_DIR"

echo "Backup written to ${OUTPUT_DIR}.tar.gz"
