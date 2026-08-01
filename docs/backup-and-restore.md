# Backup And Restore

Owner-only backup APIs manage local ZIP backups under `data/backups/`. These API archives contain storage files, a manifest, checksums, and a database marker. They do not include a PostgreSQL dump.

The Raspberry Pi systemd timer runs `deploy/backup.sh`. That shell backup creates a PostgreSQL custom-format dump, copies receipt, asset, vault, and OCR storage folders, writes checksums, and creates an atomically renamed tar archive.

Restore verification can be run without modifying live data:

```bash
./deploy/verify-backup.sh data/backups/<backup-file>.tar.gz
./deploy/restore.sh data/backups/<backup-file>.tar.gz --verify-only
./deploy/restore.sh data/backups/<backup-file>.tar.gz --dry-run
```

Live restore requires:

```bash
./deploy/restore.sh data/backups/<backup-file>.tar.gz --confirm-restore
```

Use `--database-only` or `--files-only` for partial recovery. The restore script validates archive paths before extraction and refuses destructive restore unless confirmation is explicit.
