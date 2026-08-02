# Storage Layout

Runtime files are stored outside PostgreSQL and ignored by Git.

```text
data/
  assets/
    <user_uuid>/
      <asset_uuid>/
        <year>/
          <month>/
            <generated_filename>
  vault/
    <user_uuid>/
      <folder>/
        <year>/
          <month>/
            <generated_filename>
  receipts/
    <user_uuid>/
      <year>/
        <month>/
          <generated_filename>
  ocr/
    <user_uuid>/
      <source_type>/
        <source_id>/
          <ocr_result_id>.txt
  backups/
    owi-backup-<utc_stamp>-<id>.zip
    <utc_stamp>.tar.gz
```

PostgreSQL stores only metadata and relationships. API responses do not expose filesystem paths.

API backups create ZIP archives named `owi-backup-...zip` in `data/backups/`. They include local storage files, a JSON manifest, and a database marker explaining that the API archive does not contain a PostgreSQL dump.

Shell backups create `<utc_stamp>.tar.gz` archives through `deploy/backup.sh`. They include a PostgreSQL custom-format dump, runtime file roots when present, checksum files, non-secret recovery configuration, and the deployment scripts required for restore verification.

## Docker Permissions

The backend and OCR worker run as a non-root `owi` user. Docker startup prepares the five
storage roots, assigns them to the configured `PUID:PGID`, and verifies write access before
starting the API or worker loop. Raspberry Pi deployments should set `PUID=$(id -u)` and
`PGID=$(id -g)` in `.env` so uploads, OCR artifacts, backup archives, and host backup scripts
all use the same owner/group.
