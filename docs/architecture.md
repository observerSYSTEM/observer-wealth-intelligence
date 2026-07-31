# Architecture

Observer Wealth Intelligence is split into independent backend, frontend, database, and deployment layers.

## Backend

The backend is a FastAPI application under `backend/app`.

- `api/` defines versioned HTTP routes and dependencies.
- `core/` contains configuration and security utilities.
- `db/` owns SQLAlchemy metadata, engine, and session wiring.
- `models/` contains SQLAlchemy ORM models.
- `schemas/` contains Pydantic request and response contracts.
- `services/` contains authentication, session, settings, audit, rate-limit, and other application operations used by routes.

Alembic migrations live in `backend/alembic`. The first migration creates the initial `users` table; the second migration adds owner/user roles, profile fields, refresh sessions, settings, and audit logs.

Authentication uses short-lived JWT access tokens and rotating refresh tokens stored in HTTP-only cookies. Refresh tokens are persisted only as HMAC hashes. State-changing requests require CSRF validation through the readable CSRF cookie and `X-CSRF-Token` header.

## Frontend

The frontend is a Next.js App Router application under `frontend`.

- `app/` contains route entry points and global styles.
- `components/` contains reusable UI.
- `lib/` contains browser-safe utilities.

The dashboard and account pages use client-side route protection. Fresh installations redirect to `/setup`; unauthenticated users redirect to `/login`.

## Database

PostgreSQL is the system of record. The application connects through SQLAlchemy using the `DATABASE_URL` environment variable.

## Deployment

Docker Compose runs PostgreSQL, the backend API, the frontend, and an optional Nginx reverse proxy. Production and Raspberry Pi compose overlays adjust ports, runtime mode, and resource usage.
