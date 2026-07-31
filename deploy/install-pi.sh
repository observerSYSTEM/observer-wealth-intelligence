#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_FILE="/etc/systemd/system/observer-wealth-intelligence.service"

cd "$PROJECT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env. Set SECRET_KEY before exposing this service beyond localhost."
fi

mkdir -p backups
sudo install -m 0644 deploy/systemd/observer-wealth-intelligence.service "$SERVICE_FILE"
sudo systemctl daemon-reload
sudo systemctl enable observer-wealth-intelligence
docker compose -f docker-compose.yml -f docker-compose.pi.yml up --build -d
sudo systemctl restart observer-wealth-intelligence
docker compose -f docker-compose.yml -f docker-compose.pi.yml ps
