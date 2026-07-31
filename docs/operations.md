# Operations

## Health Check

```bash
curl http://localhost:8000/api/v1/health
```

The endpoint checks the API process and database connection.

## Backups

```bash
./deploy/backup.sh
```

The backup script uses `pg_dump` inside the database container and writes a compressed archive under `backups/`.

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
