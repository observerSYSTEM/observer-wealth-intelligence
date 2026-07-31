# Observer Wealth Intelligence

Observer Wealth Intelligence is a private wealth tracking system designed for local-first deployment, including Raspberry Pi hosting. Milestone 1 establishes the clean project architecture: a FastAPI API, PostgreSQL persistence, Alembic migrations, JWT authentication primitives, and a responsive Next.js dashboard shell with light and dark modes.

## Architecture

- `backend/` contains the FastAPI application, SQLAlchemy models, Alembic migrations, and API services.
- `frontend/` contains the Next.js TypeScript application and Tailwind UI system.
- `docker/` contains production container images, entrypoints, and reverse-proxy configuration.
- `deploy/` contains install, backup, update, and systemd deployment assets.
- `database/` contains PostgreSQL runtime configuration.
- `docs/` contains architecture, environment, deployment, and operations notes.
- `.github/` contains CI workflow configuration.

## Local Development

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

The frontend runs on `http://localhost:3000`, the backend API runs on `http://localhost:8000`, and PostgreSQL is exposed on `localhost:5432`.

## Production

```bash
cp .env.example .env
# edit .env and set a strong SECRET_KEY
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

The production reverse proxy serves the app on `http://localhost:8080`.

## Validation

Backend:

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
python -m compileall app alembic
pytest
```

Frontend:

```bash
cd frontend
npm ci
npm run typecheck
npm run lint
npm run build
```

## Roadmap

The detailed milestone plan is in `ROADMAP.md`.
