# Architecture

Observer Wealth Intelligence is split into independent backend, frontend, database, and deployment layers.

## Backend

The backend is a FastAPI application under `backend/app`.

- `api/` defines versioned HTTP routes and dependencies.
- `core/` contains configuration and security utilities.
- `db/` owns SQLAlchemy metadata, engine, and session wiring.
- `models/` contains SQLAlchemy ORM models.
- `schemas/` contains Pydantic request and response contracts.
- `services/` contains application operations used by routes.

Alembic migrations live in `backend/alembic`. The first migration creates the `users` table used by JWT authentication.

## Frontend

The frontend is a Next.js App Router application under `frontend`.

- `app/` contains route entry points and global styles.
- `components/` contains reusable UI.
- `lib/` contains browser-safe utilities.

The dashboard reads live health state from the API and renders empty financial totals until persisted records are introduced in later milestones.

## Database

PostgreSQL is the system of record. The application connects through SQLAlchemy using the `DATABASE_URL` environment variable.

## Deployment

Docker Compose runs PostgreSQL, the backend API, the frontend, and an optional Nginx reverse proxy. Production and Raspberry Pi compose overlays adjust ports, runtime mode, and resource usage.
