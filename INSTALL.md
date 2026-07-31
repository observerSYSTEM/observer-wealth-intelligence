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

## Development Install

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Open:

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:8000/api/v1/health`

## Production Install

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Open `http://localhost:8080`.

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

## Update

```bash
./deploy/update.sh
```
