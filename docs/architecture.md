# Architecture

Observer Wealth Intelligence is split into independent backend, frontend, database, and deployment layers.

## Backend

The backend is a FastAPI application under `backend/app`.

- `api/` defines versioned HTTP routes and dependencies.
- `core/` contains configuration and security utilities.
- `db/` owns SQLAlchemy metadata, engine, and session wiring.
- `models/` contains SQLAlchemy ORM models.
- `schemas/` contains Pydantic request and response contracts.
- `services/` contains authentication, session, settings, audit, rate-limit, wealth-entry, dashboard, and receipt-storage operations used by routes.

Alembic migrations live in `backend/alembic`. The first migration creates the initial `users` table; the second migration adds owner/user roles, profile fields, refresh sessions, settings, and audit logs. The third migration adds `wealth_entries` and `receipts`.

Authentication uses short-lived JWT access tokens and rotating refresh tokens stored in HTTP-only cookies. Refresh tokens are persisted only as HMAC hashes. State-changing requests require CSRF validation through the readable CSRF cookie and `X-CSRF-Token` header.

## Frontend

The frontend is a Next.js App Router application under `frontend`.

- `app/` contains route entry points and global styles.
- `components/` contains reusable UI.
- `lib/` contains browser-safe utilities.

The dashboard, entry, receipt, and account pages use client-side route protection. Fresh installations redirect to `/setup`; unauthenticated users redirect to `/login`.

## Daily Wealth Entries

Wealth entries are authenticated, owner-scoped records of realised profit and actual allocation outcomes. The backend records authoritative UTC timestamps, derives default local entry dates from the user's timezone, blocks accidental future dates unless confirmed, and requires confirmation for likely duplicate forex entries on the same date.

Allocation percentages are read from settings when an entry is created and stored on the entry. Recommendations are rounded to two decimal places with decimal-safe arithmetic. Actual savings are the source of truth for totals, including amounts above target. Zero-profit and negative-profit entries create no positive savings obligation.

Discipline scores are deterministic: 100 at or above target, 80 at or above 80%, 50 at or above 50%, 25 for any positive saving below 50%, 0 for no saving against a positive target, and `null` when no savings are required.

## Receipts

Receipt metadata is stored in PostgreSQL and file content is stored locally under `data/receipts/<user_uuid>/<year>/<month>/`. Uploads validate MIME type, extension, file signature, size, and SHA-256 checksum. Duplicate receipt detection is scoped per user. The API never exposes storage paths.

Each receipt can be linked to one entry. Entry deletion keeps receipt metadata. Receipt deletion detaches the receipt, removes the local file if present, and marks the metadata row deleted.

## Dashboard

The dashboard summarizes authenticated-user entries only. It labels wealth as `Tracked Savings` until asset tracking exists. Goal progress uses only actual savings in the primary goal currency; no FX conversion is performed in this milestone. Entries in other currencies are shown separately.

The saving streak counts consecutive eligible positive-profit days where all entries met or exceeded target. Days with no entries, weekends, zero-profit entries, or losing entries are ignored; a positive-profit below-target day breaks the streak.

## Database

PostgreSQL is the system of record. The application connects through SQLAlchemy using the `DATABASE_URL` environment variable.

## Deployment

Docker Compose runs PostgreSQL, the backend API, the frontend, and an optional Nginx reverse proxy. Production and Raspberry Pi compose overlays adjust ports, runtime mode, and resource usage.
