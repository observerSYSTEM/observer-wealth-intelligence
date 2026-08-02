#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required before installation." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required before installation." >&2
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example."
fi

. ./deploy/env-secrets.sh
ensure_env_secret_values .env
echo "Ensured local .env secret values are present. Do not commit .env."

docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
docker compose ps
