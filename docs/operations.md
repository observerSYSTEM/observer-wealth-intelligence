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
