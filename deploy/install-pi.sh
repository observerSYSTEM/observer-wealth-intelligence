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

mkdir -p data/backups data/assets data/vault data/receipts data/ocr
sudo chown -R 10001:"$(id -g)" data
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
