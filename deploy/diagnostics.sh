#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

env_value() {
  local key="$1"
  [ -f .env ] || return 0
  awk -F= -v key="$key" '
    $0 !~ /^[[:space:]]*#/ && $1 ~ "^[[:space:]]*" key "[[:space:]]*$" {
      value=$0
      sub(/^[^=]*=/, "", value)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      gsub(/^"|"$/, "", value)
      gsub(/^'\''|'\''$/, "", value)
      print value
    }
  ' .env | tail -n 1
}

redact() {
  sed -E \
    -e 's/(SECRET_KEY|POSTGRES_PASSWORD|DATABASE_URL|TELEGRAM_BOT_TOKEN|OWI_PASSWORD|REFRESH_TOKEN|ACCESS_TOKEN)=([^[:space:]]+)/\1=[redacted]/Ig' \
    -e 's#postgresql(\+psycopg)?://[^[:space:]]+#postgresql://[redacted]#Ig' \
    -e 's/(Bearer )[A-Za-z0-9._-]+/\1[redacted]/g' \
    -e 's/(owi_access_token|owi_refresh_token|owi_csrf_token)=([^;[:space:]]+)/\1=[redacted]/g'
}

section() {
  printf '\n== %s ==\n' "$1"
}

run() {
  "$@" 2>&1 | redact || true
}

compose_args=(-f docker-compose.yml)
compose_overlay="${COMPOSE_OVERLAY:-docker-compose.pi.yml}"
if [ -n "$compose_overlay" ] && [ -f "$compose_overlay" ]; then
  compose_args+=(-f "$compose_overlay")
fi

http_port="${HTTP_PORT:-$(env_value HTTP_PORT)}"
http_port="${http_port:-8080}"
base_url="${OWI_BASE_URL:-http://localhost:${http_port}}"
postgres_user="${POSTGRES_USER:-$(env_value POSTGRES_USER)}"
postgres_user="${postgres_user:-observer}"
postgres_db="${POSTGRES_DB:-$(env_value POSTGRES_DB)}"
postgres_db="${postgres_db:-observer_wealth}"

receipt_path="${RECEIPT_STORAGE_PATH:-$(env_value RECEIPT_STORAGE_PATH)}"
asset_path="${ASSET_STORAGE_PATH:-$(env_value ASSET_STORAGE_PATH)}"
vault_path="${VAULT_STORAGE_PATH:-$(env_value VAULT_STORAGE_PATH)}"
ocr_path="${OCR_STORAGE_PATH:-$(env_value OCR_STORAGE_PATH)}"
backup_path="${BACKUP_STORAGE_PATH:-$(env_value BACKUP_STORAGE_PATH)}"
backup_dir="${BACKUP_DIR:-$(env_value BACKUP_DIR)}"

receipt_path="${receipt_path:-data/receipts}"
asset_path="${asset_path:-data/assets}"
vault_path="${vault_path:-data/vault}"
ocr_path="${ocr_path:-data/ocr}"
backup_path="${backup_path:-data/backups}"
backup_dir="${backup_dir:-$backup_path}"

section "Observer Wealth Intelligence Diagnostics"
printf 'Generated: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
printf 'Repository: %s\n' "$ROOT"
printf 'Branch: %s\n' "$(git branch --show-current 2>/dev/null || echo unknown)"
printf 'Commit: %s\n' "$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
printf 'Base URL: %s\n' "$base_url"

section "App Version And Health"
if command -v curl >/dev/null 2>&1; then
  run curl -fsS "${base_url}/api/v1/health"
  printf '\n'
  run curl -fsS "${base_url}/api/v1/auth/setup-status"
  printf '\n'
else
  echo "curl is not installed."
fi

section "Container Status"
if command -v docker >/dev/null 2>&1; then
  run docker compose "${compose_args[@]}" ps
else
  echo "docker is not installed."
fi

section "Database Readiness"
if command -v docker >/dev/null 2>&1; then
  run docker compose "${compose_args[@]}" exec -T db pg_isready -U "$postgres_user" -d "$postgres_db"
else
  echo "docker is not installed."
fi

section "Disk Usage"
run df -h .
[ -d data ] && run du -sh data data/* || echo "data directory is missing."

section "Storage Permissions"
for path in "$receipt_path" "$asset_path" "$vault_path" "$ocr_path" "$backup_path"; do
  if [ -d "$path" ]; then
    permissions=""
    [ -r "$path" ] && permissions="${permissions}r" || permissions="${permissions}-"
    [ -w "$path" ] && permissions="${permissions}w" || permissions="${permissions}-"
    [ -x "$path" ] && permissions="${permissions}x" || permissions="${permissions}-"
    printf '%s %s ' "$permissions" "$path"
    run ls -ld "$path"
  else
    printf 'missing %s\n' "$path"
  fi
done

section "Backup Status"
if command -v systemctl >/dev/null 2>&1; then
  run systemctl is-active observer-wealth-backup.timer
  run systemctl list-timers observer-wealth-backup.timer --no-pager
fi
if [ -d "$backup_dir" ]; then
  find "$backup_dir" -maxdepth 1 -type f \( -name '*.tar.gz' -o -name '*.zip' \) \
    -printf '%TY-%Tm-%Td %TH:%TM %s bytes %p\n' 2>/dev/null | sort -r | head -n 5 | redact
else
  printf 'Backup directory is missing: %s\n' "$backup_dir"
fi

section "Recent Relevant Error Logs"
if command -v docker >/dev/null 2>&1; then
  {
    docker compose "${compose_args[@]}" logs --tail 300 backend ocr-worker frontend nginx 2>&1
    if command -v journalctl >/dev/null 2>&1; then
      journalctl -u observer-wealth-intelligence -u observer-wealth-backup --no-pager -n 300 2>&1
    fi
  } | grep -Ei 'error|exception|traceback|failed|critical|warning|denied' | tail -n 100 | redact || true
else
  echo "docker is not installed."
fi

section "Diagnostics Complete"
