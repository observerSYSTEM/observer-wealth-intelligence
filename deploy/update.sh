#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

OVERLAY="${COMPOSE_OVERLAY:-docker-compose.prod.yml}"

if [ -d .git ]; then
  git pull --ff-only
fi

docker compose -f docker-compose.yml -f "$OVERLAY" build
docker compose -f docker-compose.yml -f "$OVERLAY" up -d
docker compose -f docker-compose.yml -f "$OVERLAY" ps
