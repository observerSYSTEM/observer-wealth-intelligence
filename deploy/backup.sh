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

tar -czf "${OUTPUT_DIR}.tar.gz" -C "$BACKUP_DIR" "$STAMP"
rm -rf "$OUTPUT_DIR"

echo "Backup written to ${OUTPUT_DIR}.tar.gz"
