#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_FILE="/etc/systemd/system/observer-wealth-intelligence.service"
BACKUP_SERVICE_FILE="/etc/systemd/system/observer-wealth-backup.service"
BACKUP_TIMER_FILE="/etc/systemd/system/observer-wealth-backup.timer"

cd "$PROJECT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env."
fi

. ./deploy/env-secrets.sh
ensure_env_secret_values .env
echo "Ensured local .env secret values are present. Do not commit .env."

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
sudo install -m 0644 deploy/systemd/observer-wealth-intelligence.service "$SERVICE_FILE"
sudo install -m 0644 deploy/systemd/observer-wealth-backup.service "$BACKUP_SERVICE_FILE"
sudo install -m 0644 deploy/systemd/observer-wealth-backup.timer "$BACKUP_TIMER_FILE"
sudo systemctl daemon-reload
sudo systemctl enable observer-wealth-intelligence
sudo systemctl enable observer-wealth-backup.timer
docker compose -f docker-compose.yml -f docker-compose.pi.yml up --build -d
sudo systemctl restart observer-wealth-intelligence
sudo systemctl restart observer-wealth-backup.timer
docker compose -f docker-compose.yml -f docker-compose.pi.yml ps
