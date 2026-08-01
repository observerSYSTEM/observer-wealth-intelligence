# Troubleshooting

## Preflight Fails Architecture

Install 64-bit Raspberry Pi OS. RC1 does not target 32-bit ARM.

## Docker Daemon Unavailable

```bash
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Log out and back in after adding the Docker group.

## Port In Use

Set another port in `.env`:

```bash
HTTP_PORT=8081
```

Then restart:

```bash
sudo systemctl restart observer-wealth-intelligence
```

## Permission Denied Writing Files

```bash
sudo chown -R 10001:10001 data
docker compose -f docker-compose.yml -f docker-compose.pi.yml restart backend ocr-worker
```

## OCR Model Download Fails

Check internet access and worker logs:

```bash
./deploy/preflight-pi.sh
docker compose -f docker-compose.yml -f docker-compose.pi.yml logs -f ocr-worker
```

Retry the OCR job after connectivity is restored.

## Migrations Fail

Do not delete a database with data. Capture logs:

```bash
docker compose -f docker-compose.yml -f docker-compose.pi.yml logs backend
docker compose -f docker-compose.yml -f docker-compose.pi.yml exec backend alembic current
docker compose -f docker-compose.yml -f docker-compose.pi.yml exec backend alembic history
```

Restore from a verified backup if the database is damaged.

## Backup Fails

Check Docker, disk, and permissions:

```bash
df -h
docker compose -f docker-compose.yml -f docker-compose.pi.yml ps
sudo journalctl -u observer-wealth-backup -n 200
```

## Restore Refused

`deploy/restore.sh` requires `--confirm-restore` for live writes. Run `--verify-only` and `--dry-run` first.

## Protected Routes Still Visible After Logout

Refresh the browser and confirm cookies were cleared. The app clears private offline caches on logout and session expiry.
