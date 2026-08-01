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

The backup script uses `pg_dump` inside the database container and writes a compressed archive under `backups/`.

The archive includes:

- A PostgreSQL custom-format dump.
- Receipt files from `RECEIPT_STORAGE_PATH` when the directory exists.
- Asset documents from `ASSET_STORAGE_PATH` when the directory exists.
- Vault documents from `VAULT_STORAGE_PATH` when the directory exists.
- OCR text artifacts from `OCR_STORAGE_PATH` when the directory exists.
- Non-secret recovery configuration, including Compose overlays, Docker config, deployment scripts, systemd config, database config, and `.env.example`.
- A manifest and `SHA256SUMS` file when checksum tooling is available.

The script excludes `.env` by default. Set `INCLUDE_SECRETS_IN_BACKUP=true` only when the backup destination is encrypted and intentionally allowed to contain secrets.

The script validates the compressed archive with `tar -tzf` before reporting success. To perform a manual checksum verification after extraction:

```bash
cd extracted-backup-directory
sha256sum -c SHA256SUMS
```

Uploaded files and OCR artifacts live outside PostgreSQL, so a complete recovery requires the database dump plus the receipt, asset, vault, and OCR directories captured in the archive.

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
```

## Owner Recovery

No email password reset exists in this release. Recovery must happen from local administrator access by replacing the owner `password_hash` with a locally generated Argon2 hash and revoking the owner's refresh sessions.
