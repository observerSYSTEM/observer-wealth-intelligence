# Raspberry Pi Operations

Target: Raspberry Pi 5, ARM64, 64-bit Raspberry Pi OS, Docker Engine, Docker Compose plugin, at least 4 GB RAM, timezone `Europe/London`.

## Preflight

```bash
cd /opt/observer-wealth-intelligence
./deploy/preflight-pi.sh
```

Resolve every `FAIL` before deployment. Review every `WARNING` before RC approval.

## Install

```bash
sudo mkdir -p /opt/observer-wealth-intelligence
sudo chown "$USER:$USER" /opt/observer-wealth-intelligence
git clone <private-repository-url> /opt/observer-wealth-intelligence
cd /opt/observer-wealth-intelligence
git switch release/v1.0-rc1
cp .env.example .env
sed -i "s/^PUID=.*/PUID=$(id -u)/; s/^PGID=.*/PGID=$(id -g)/" .env
nano .env
chmod +x deploy/*.sh docker/backend/entrypoint.sh
./deploy/install-pi.sh
```

Set `SECRET_KEY`, `POSTGRES_PASSWORD`, `COOKIE_SECURE`, `CORS_ORIGINS`, `PUID`, `PGID`, and storage paths before exposing the service. Keep `COOKIE_SECURE=false` while serving OWI over plain HTTP on a LAN. Use `COOKIE_SECURE=true` only after HTTPS is enabled.

## Start, Stop, Status, Logs

```bash
sudo systemctl start observer-wealth-intelligence
sudo systemctl stop observer-wealth-intelligence
sudo systemctl restart observer-wealth-intelligence
sudo systemctl status observer-wealth-intelligence
sudo journalctl -u observer-wealth-intelligence -f

docker compose -f docker-compose.yml -f docker-compose.pi.yml ps
docker compose -f docker-compose.yml -f docker-compose.pi.yml logs -f backend
docker compose -f docker-compose.yml -f docker-compose.pi.yml logs -f ocr-worker
docker compose -f docker-compose.yml -f docker-compose.pi.yml exec -T ocr-worker python -m app.workers.ocr_worker --healthcheck
```

## Update

```bash
git fetch --all --prune
git switch release/v1.0-rc1
git pull --ff-only
COMPOSE_OVERLAY=docker-compose.pi.yml ./deploy/update.sh
```

## Backup And Verify

```bash
./deploy/backup.sh
./deploy/verify-backup.sh data/backups/<backup-file>.tar.gz
./deploy/backup-retention-dry-run.sh
```

## Restore

Verify first:

```bash
./deploy/restore.sh data/backups/<backup-file>.tar.gz --verify-only
./deploy/restore.sh data/backups/<backup-file>.tar.gz --dry-run
```

Restore only in a controlled environment unless the active instance is intentionally being recovered:

```bash
./deploy/restore.sh data/backups/<backup-file>.tar.gz --confirm-restore
```

## Reboot Recovery

```bash
sudo reboot
sudo systemctl status observer-wealth-intelligence
sudo systemctl status observer-wealth-backup.timer
docker compose -f docker-compose.yml -f docker-compose.pi.yml ps
curl http://localhost:${HTTP_PORT:-8080}/api/v1/health
```

## Change Secrets

1. Stop public access.
2. Edit `.env`.
3. Restart the stack.
4. Confirm login and health.
5. Revoke existing sessions if `SECRET_KEY` or password policy changed.

## Add Storage

Mount external storage under `/opt/observer-wealth-intelligence/data` or update the storage paths in `.env`. Use a Linux filesystem such as ext4 so Docker can apply owner/group permissions. Then run:

```bash
sudo chown -R "$(grep '^PUID=' .env | cut -d= -f2):$(grep '^PGID=' .env | cut -d= -f2)" data
sudo chmod -R u+rwX,g+rwX,o-rwx data
docker compose -f docker-compose.yml -f docker-compose.pi.yml restart backend ocr-worker
```

## Permissions

Backend and OCR worker run as the non-root UID/GID configured by `PUID` and `PGID`.
On Raspberry Pi deployments, use the deployment user's ids so Docker services, backup scripts,
and shell maintenance commands share ownership:

```bash
sed -i "s/^PUID=.*/PUID=$(id -u)/; s/^PGID=.*/PGID=$(id -g)/" .env
sudo chown -R "$(id -u):$(id -g)" data
sudo chmod -R u+rwX,g+rwX,o-rwx data
docker compose -f docker-compose.yml -f docker-compose.pi.yml up --build -d backend ocr-worker
```

## OCR Model Download

The first real OCR run may download EasyOCR models and use more time, CPU, RAM, and internet bandwidth than warm runs. Keep the web app open and monitor:

```bash
docker stats
docker compose -f docker-compose.yml -f docker-compose.pi.yml logs -f ocr-worker
```

OCR jobs are database-backed. If the Pi restarts while a receipt is processing, the
`ocr-worker` requeues stale `processing` rows older than `OCR_PROCESSING_TIMEOUT_SECONDS`
on startup. To refresh the worker without touching data:

```bash
docker compose -f docker-compose.yml -f docker-compose.pi.yml up -d --build ocr-worker
docker compose -f docker-compose.yml -f docker-compose.pi.yml logs --tail 100 ocr-worker
```

## Uninstall Without Deleting Data

```bash
sudo systemctl disable --now observer-wealth-intelligence
sudo systemctl disable --now observer-wealth-backup.timer
docker compose -f docker-compose.yml -f docker-compose.pi.yml down
```

Leave `/opt/observer-wealth-intelligence/data` and the Docker volume intact.

## Complete Uninstall With Explicit Data Deletion

Only run after a verified backup:

```bash
docker compose -f docker-compose.yml -f docker-compose.pi.yml down -v
sudo rm -rf /opt/observer-wealth-intelligence
```
