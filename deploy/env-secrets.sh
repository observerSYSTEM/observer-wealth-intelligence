#!/usr/bin/env bash
set -euo pipefail

generate_env_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
    return
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
    return
  fi

  echo "Install openssl or python3 to generate local environment secrets." >&2
  exit 1
}

read_env_value() {
  local key="$1"
  local env_file="$2"
  if [ ! -f "$env_file" ]; then
    return 0
  fi
  awk -F= -v key="$key" '$1 == key { value = substr($0, length(key) + 2) } END { print value }' "$env_file"
}

write_env_value() {
  local key="$1"
  local value="$2"
  local env_file="$3"
  local temp_file
  temp_file="$(mktemp)"

  awk -v key="$key" -v value="$value" '
    BEGIN { written = 0 }
    index($0, key "=") == 1 {
      print key "=" value
      written = 1
      next
    }
    { print }
    END {
      if (written == 0) {
        print key "=" value
      }
    }
  ' "$env_file" > "$temp_file"

  mv "$temp_file" "$env_file"
}

ensure_env_secret_values() {
  local env_file="${1:-.env}"
  local postgres_db
  local postgres_user
  local postgres_password
  local secret_key

  if [ ! -f "$env_file" ]; then
    echo "Environment file not found: $env_file" >&2
    exit 1
  fi

  postgres_db="$(read_env_value POSTGRES_DB "$env_file")"
  postgres_user="$(read_env_value POSTGRES_USER "$env_file")"
  postgres_password="$(read_env_value POSTGRES_PASSWORD "$env_file")"
  secret_key="$(read_env_value SECRET_KEY "$env_file")"

  postgres_db="${postgres_db:-observer_wealth}"
  postgres_user="${postgres_user:-observer}"

  if [ -z "$secret_key" ] || [ "$secret_key" = "replace-with-a-strong-random-secret" ] || [ "$secret_key" = "development-secret-change-before-production" ]; then
    write_env_value SECRET_KEY "$(generate_env_secret)" "$env_file"
  fi

  if [ -z "$postgres_password" ] || [ "$postgres_password" = "observer-local-password" ]; then
    postgres_password="$(generate_env_secret)"
    write_env_value POSTGRES_PASSWORD "$postgres_password" "$env_file"
  fi

  if [ -z "$(read_env_value DATABASE_URL "$env_file")" ] || read_env_value DATABASE_URL "$env_file" | grep -q "observer-local-password"; then
    write_env_value DATABASE_URL "postgresql+psycopg://${postgres_user}:${postgres_password}@db:5432/${postgres_db}" "$env_file"
  fi

  chmod 600 "$env_file" 2>/dev/null || true
}
