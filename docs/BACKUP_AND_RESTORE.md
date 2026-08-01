# Backup And Restore

## Backup Types

API backups create ZIP archives under `data/backups` and verify storage-file checksums. They do not include a PostgreSQL dump.

Shell backups use `deploy/backup.sh`. They include:

- PostgreSQL custom-format dump.
- Receipt files.
- Asset documents.
- Vault documents.
- OCR artifacts.
- Non-secret deployment configuration.
- Manifest and checksums.

`.env` is excluded by default. Set `INCLUDE_SECRETS_IN_BACKUP=true` only for encrypted destinations.

## Manual Backup

```bash
./deploy/backup.sh
```

## Verify

```bash
./deploy/verify-backup.sh data/backups/<backup-file>.tar.gz
./deploy/restore.sh data/backups/<backup-file>.tar.gz --verify-only
```

## Dry Run

```bash
./deploy/restore.sh data/backups/<backup-file>.tar.gz --dry-run
./deploy/backup-retention-dry-run.sh
```

## Restore Drill

Perform full restore only in a disposable environment:

```bash
./deploy/restore.sh data/backups/<backup-file>.tar.gz --database-only --confirm-restore
./deploy/restore.sh data/backups/<backup-file>.tar.gz --files-only --confirm-restore
./deploy/restore.sh data/backups/<backup-file>.tar.gz --confirm-restore
```

Validate restored owner login, entries, receipts, assets, vault documents, OCR artifacts, goals, and timeline.

## Failure Checks

- Corrupt checksum must fail verification.
- Archive path traversal entries must be rejected.
- Missing PostgreSQL dump must fail shell backup verification.
- Incomplete `.tmp` archives must not be treated as successful.
