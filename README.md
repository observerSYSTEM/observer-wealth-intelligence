# Observer Wealth Intelligence

Observer Wealth Intelligence is a private wealth tracking system designed for local-first deployment, including Raspberry Pi hosting. The current build includes the clean FastAPI/Next.js architecture plus private-user authentication, first-owner setup, profile management, application settings, rotating refresh sessions, and light/dark UI support.

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

Fresh installations redirect to `/setup`. The first registered account becomes the `owner`, then public registration is disabled until the owner enables it in settings.

## Production

```bash
cp .env.example .env
# edit .env and set a strong SECRET_KEY
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

The production reverse proxy serves the app on `http://localhost:8080`.

Production deployments must use a strong `SECRET_KEY` and secure cookies. Set `COOKIE_SECURE=true` when serving over HTTPS.

## Authentication

- Access tokens are short-lived JWTs stored in HTTP-only cookies.
- Refresh tokens are random secrets stored in HTTP-only cookies and persisted only as hashes.
- Refresh tokens rotate on use; reuse of an old refresh token revokes active sessions.
- CSRF protection uses a separate readable CSRF cookie and `X-CSRF-Token` header for state-changing requests.
- Login attempts are rate-limited by email and client address.
- Passwords are hashed with Argon2 and must meet strength requirements.

There is no email-based password reset in this private first release. Owner recovery is a local administrator operation documented in `ARCHITECTURE.md`.

## Validation

Backend:

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
python -m compileall app alembic
pytest
mypy app
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
