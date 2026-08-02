#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

OVERLAY="${COMPOSE_OVERLAY:-docker-compose.prod.yml}"

if [ -d .git ]; then
  git pull --ff-only
fi

if [ -f .env ]; then
  . ./deploy/env-secrets.sh
  container_uid="$(read_env_value PUID .env)"
  container_gid="$(read_env_value PGID .env)"
  if [ -z "$container_uid" ]; then
    container_uid="$(id -u)"
    write_env_value PUID "$container_uid" .env
  fi
  if [ -z "$container_gid" ]; then
    container_gid="$(id -g)"
    write_env_value PGID "$container_gid" .env
  fi
  case "$container_uid" in
    ''|*[!0-9]*|0)
      echo "PUID must be a non-root numeric uid in .env." >&2
      exit 1
      ;;
  esac
  case "$container_gid" in
    ''|*[!0-9]*|0)
      echo "PGID must be a non-root numeric gid in .env." >&2
      exit 1
      ;;
  esac
  mkdir -p data/backups data/assets data/vault data/receipts data/ocr
  sudo chown -R "${container_uid}:${container_gid}" data
  sudo chmod -R u+rwX,g+rwX,o-rwx data
fi

docker compose -f docker-compose.yml -f "$OVERLAY" build
docker compose -f docker-compose.yml -f "$OVERLAY" up -d
docker compose -f docker-compose.yml -f "$OVERLAY" ps
