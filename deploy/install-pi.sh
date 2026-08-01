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
  echo "Created .env. Set SECRET_KEY before exposing this service beyond localhost."
fi

mkdir -p data/backups data/assets data/vault data/receipts data/ocr
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
