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

`SECRET_KEY`, `POSTGRES_PASSWORD`, and `DATABASE_URL` are intentionally blank in `.env.example`.
The install scripts generate local values when they create `.env`. For manual setup, set those
values before running Compose and keep `.env` out of source control.

Example manual generation:

```bash
SECRET_KEY="$(openssl rand -hex 32)"
POSTGRES_PASSWORD="$(openssl rand -hex 32)"
DATABASE_URL="postgresql+psycopg://observer:${POSTGRES_PASSWORD}@db:5432/observer_wealth"
```

Uploaded files and OCR artifacts are stored outside PostgreSQL. The default layout is:

```bash
APP_VERSION=1.0.0-rc.1
RECEIPT_STORAGE_PATH=data/receipts
RECEIPT_MAX_FILE_SIZE_BYTES=10485760
ASSET_STORAGE_PATH=data/assets
VAULT_STORAGE_PATH=data/vault
OCR_STORAGE_PATH=data/ocr
BACKUP_STORAGE_PATH=data/backups
VAULT_MAX_FILE_SIZE_BYTES=26214400
EASYOCR_LANGUAGES=["en"]
OCR_LOW_CONFIDENCE_THRESHOLD=70
OCR_PDF_PAGE_LIMIT=3
OCR_PDF_RENDER_DPI=150
OCR_IMAGE_MAX_PIXELS=20000000
OCR_MAX_RETRIES=3
OCR_WORKER_POLL_SECONDS=5
TELEGRAM_NOTIFICATIONS_ENABLED=false
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
BACKUP_SCHEDULE_ENABLED=false
BACKUP_SCHEDULE_TIME=02:30
```

Keep these storage paths on persistent disk and size them for payment screenshots, PDFs, asset documents, vault documents, OCR text artifacts, and backups. On Raspberry Pi deployments, prefer an SD card or external disk with enough spare capacity for the database volume, uploaded files, OCR output, and backup archives.

The OCR foundation uses EasyOCR, PyMuPDF, and Pillow. Compose runs OCR in the separate `ocr-worker` service so API uploads stay responsive while documents are processed locally.

For HTTP Raspberry Pi or localhost LAN deployments, keep:

```bash
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
```

The `Secure` cookie flag is only valid when the browser reaches OWI over HTTPS. If
`COOKIE_SECURE=true` is used on an HTTP LAN URL, browsers will ignore the login cookies and
authenticated requests will immediately return `401`.

For HTTPS deployments, set:

```bash
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
```

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
git switch release/v1.0-rc1
cp .env.example .env
nano .env
./deploy/preflight-pi.sh
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
The default backup directory is `data/backups/`; `BACKUP_DIR` can override the shell script destination.

Backups also include receipt files, asset files, vault files, OCR artifacts, and non-secret recovery configuration. The `.env` file is excluded by default; set `INCLUDE_SECRETS_IN_BACKUP=true` only when writing to encrypted storage and you intentionally want secrets inside the archive.

Each backup archive includes a `SHA256SUMS` file when checksum tooling is available, and the script verifies that the compressed archive can be listed before it reports success.

Restore verification without writing over live data:

```bash
./deploy/verify-backup.sh data/backups/<backup-file>.tar.gz
./deploy/restore.sh data/backups/<backup-file>.tar.gz --verify-only
./deploy/restore.sh data/backups/<backup-file>.tar.gz --dry-run
```

Live restore requires explicit confirmation:

```bash
./deploy/restore.sh data/backups/<backup-file>.tar.gz --confirm-restore
```

On Raspberry Pi installs, `observer-wealth-backup.timer` runs the backup service daily at 02:30 unless you edit the timer or disable it with systemd.

## Update

```bash
./deploy/update.sh
```

## Local Owner Recovery

This release does not send password reset email. If the owner password is lost, use local shell access to generate a new Argon2 password hash, update the owner row in PostgreSQL, revoke refresh sessions, then log in and change the password again through `/profile`.
