# Installation

## Requirements

- Docker Engine 24 or newer
- Docker Compose v2
- Git
- Node.js 20 or newer for local frontend work
- Python 3.12 for local backend work

## Configure Environment

```bash
cp .env.example .env
```

Set `SECRET_KEY` to a strong random value before any shared or production deployment.

Receipt uploads are stored outside PostgreSQL. The default location is:

```bash
RECEIPT_STORAGE_PATH=data/receipts
RECEIPT_MAX_FILE_SIZE_BYTES=10485760
```

Keep the receipt storage path on persistent disk and size it for payment screenshots and PDF receipts. On Raspberry Pi deployments, prefer an SD card or external disk with enough spare capacity for the database volume, receipt files, and backups.

For HTTPS production deployments, set:

```bash
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
```

For localhost development, keep `COOKIE_SECURE=false`.

## Development Install

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Open:

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:8000/api/v1/health`
- First-owner setup: `http://localhost:3000/setup`

## Production Install

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Open `http://localhost:8080`.

After the first owner account is created, registration is disabled by default.

## Raspberry Pi Install

On the Pi:

```bash
sudo mkdir -p /opt/observer-wealth-intelligence
sudo chown "$USER:$USER" /opt/observer-wealth-intelligence
git clone <repository-url> /opt/observer-wealth-intelligence
cd /opt/observer-wealth-intelligence
cp .env.example .env
chmod +x deploy/*.sh docker/backend/entrypoint.sh
./deploy/install-pi.sh
```

After installation, the service is managed by systemd:

```bash
sudo systemctl status observer-wealth-intelligence
sudo journalctl -u observer-wealth-intelligence -f
```

## Backup

```bash
./deploy/backup.sh
```

Backups are written to `backups/` and include a PostgreSQL custom-format dump.

Backups also include receipt files and non-secret recovery configuration. The `.env` file is excluded by default; set `INCLUDE_SECRETS_IN_BACKUP=true` only when writing to encrypted storage and you intentionally want secrets inside the archive.

Each backup archive includes a `SHA256SUMS` file when checksum tooling is available, and the script verifies that the compressed archive can be listed before it reports success.

## Update

```bash
./deploy/update.sh
```

## Local Owner Recovery

This release does not send password reset email. If the owner password is lost, use local shell access to generate a new Argon2 password hash, update the owner row in PostgreSQL, revoke refresh sessions, then log in and change the password again through `/profile`.
