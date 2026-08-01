# Operations

## Health Check

```bash
curl http://localhost:8000/api/v1/health
```

The endpoint checks the API process and database connection.

## First Owner Setup

Open `/setup` after the first deployment. The first registered account becomes the owner and public registration is disabled immediately after creation.

## Backups

```bash
./deploy/backup.sh
```

The backup script uses `pg_dump` inside the database container and writes a compressed archive under `data/backups/` by default.

The archive includes:

- A PostgreSQL custom-format dump.
- Receipt files from `RECEIPT_STORAGE_PATH` when the directory exists.
- Asset documents from `ASSET_STORAGE_PATH` when the directory exists.
- Vault documents from `VAULT_STORAGE_PATH` when the directory exists.
- OCR text artifacts from `OCR_STORAGE_PATH` when the directory exists.
- Non-secret recovery configuration, including Compose overlays, Docker config, deployment scripts, systemd config, database config, and `.env.example`.
- A manifest and `SHA256SUMS` file when checksum tooling is available.

The script excludes `.env` by default. Set `INCLUDE_SECRETS_IN_BACKUP=true` only when the backup destination is encrypted and intentionally allowed to contain secrets.

The script validates the compressed archive with `tar -tzf` before reporting success. To perform a read-only verification:

```bash
./deploy/verify-backup.sh data/backups/<backup-file>.tar.gz
```

The restore script verifies the archive before any write. It refuses live restore unless `--confirm-restore` is present:

```bash
./deploy/restore.sh data/backups/<backup-file>.tar.gz --verify-only
./deploy/restore.sh data/backups/<backup-file>.tar.gz --dry-run
./deploy/restore.sh data/backups/<backup-file>.tar.gz --confirm-restore
```

Use `--database-only` or `--files-only` for partial recovery. File restore overlays receipt, asset, vault, and OCR folders; database restore uses `pg_restore --clean --if-exists` inside the database container.

Uploaded files and OCR artifacts live outside PostgreSQL, so a complete recovery requires the database dump plus the receipt, asset, vault, and OCR directories captured in the archive.

## OCR Worker

`ocr-worker` is a separate Compose service that runs `python -m app.workers.ocr_worker`. OCR API requests create pending rows quickly; the worker processes them with EasyOCR and PyMuPDF, writes OCR text artifacts under `data/ocr/`, and leaves results in `review_required` until the user confirms or cancels them.

On Raspberry Pi, the Pi compose overlay lowers PDF render DPI and page limits by default. Tune `OCR_PDF_PAGE_LIMIT`, `OCR_PDF_RENDER_DPI`, `OCR_IMAGE_MAX_PIXELS`, and `OCR_WORKER_POLL_SECONDS` in `.env` for the actual device.

## Scheduled Raspberry Pi Backups

`deploy/install-pi.sh` installs and enables `observer-wealth-backup.timer`. The timer runs `observer-wealth-backup.service`, which executes `deploy/backup.sh`. Use systemd to inspect or disable it:

```bash
sudo systemctl status observer-wealth-backup.timer
sudo systemctl list-timers observer-wealth-backup.timer
sudo systemctl disable --now observer-wealth-backup.timer
```

## Updates

```bash
./deploy/update.sh
```

The update script pulls the current Git branch when a repository is present, rebuilds production containers, and restarts the stack.

For Raspberry Pi updates:

```bash
COMPOSE_OVERLAY=docker-compose.pi.yml ./deploy/update.sh
```

## Systemd

```bash
sudo systemctl status observer-wealth-intelligence
sudo systemctl restart observer-wealth-intelligence
sudo journalctl -u observer-wealth-intelligence -f
sudo journalctl -u observer-wealth-backup -f
```

## Owner Recovery

No email password reset exists in this release. Recovery must happen from local administrator access by replacing the owner `password_hash` with a locally generated Argon2 hash and revoking the owner's refresh sessions.
