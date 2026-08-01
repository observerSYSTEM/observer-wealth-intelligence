# Deployment

## Development

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

This mode enables FastAPI reload and Next.js development mode.

## Production

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Production mode runs the backend behind Nginx and serves the Next.js standalone build.

## Raspberry Pi

```bash
./deploy/preflight-pi.sh
./deploy/install-pi.sh
```

The Pi overlay uses smaller PostgreSQL memory settings and installs a systemd unit that restarts the Docker Compose stack after boot. Keep `data/` on persistent storage with enough capacity for receipts, asset documents, vault documents, OCR artifacts, PDFs, and local backups.

Recommended runtime layout:

```text
data/
  assets/
  vault/
  receipts/
  ocr/
  backups/
```

The Pi overlay pins services to `linux/arm64` and installs both the app service and the backup timer.

## Database Migrations

Backend containers run `alembic upgrade head` before starting Uvicorn.

Manual migration command:

```bash
docker compose exec backend alembic upgrade head
```
