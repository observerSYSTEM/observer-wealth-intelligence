# Observer Wealth Intelligence

Observer Wealth Intelligence is a private wealth tracking system designed for local-first deployment, including Raspberry Pi hosting. The current build includes the clean FastAPI/Next.js architecture, private-user authentication, profile management, owner settings, daily wealth entries, portfolio assets, append-only value history, a digital vault, real local OCR review, multiple financial goals, notifications, scheduled backup records, a unified wealth timeline, installable PWA support, and Dashboard 3.0.

## Architecture

- `backend/` contains the FastAPI application, SQLAlchemy models, Alembic migrations, and API services.
- `frontend/` contains the Next.js TypeScript application and Tailwind UI system.
- `docker/` contains production container images, entrypoints, and reverse-proxy configuration.
- `deploy/` contains install, backup, update, and systemd deployment assets.
- `database/` contains PostgreSQL runtime configuration.
- `docs/` contains architecture, environment, deployment, and operations notes.
- `.github/` contains CI workflow configuration.

## Daily Wealth Entries

Authenticated users can record realised profit from `forex`, `business`, `employment`, or `other` sources in `GBP`, `USD`, `NGN`, or `EUR`. The backend applies the current settings percentages to each entry and stores the percentages used, so historical recommendations remain unchanged after settings edits.

Default allocation is 50% savings, 30% business, and 20% living. For a `GBP 300.00` realised profit entry, the recommended split is `GBP 150.00`, `GBP 90.00`, and `GBP 60.00`. Money is stored with fixed decimal precision and rounded consistently to two decimal places.

Actual savings are the source of truth for totals. Saving above the recommended target counts in full. Zero-profit and negative-profit entries do not create a savings obligation and do not harm discipline scores or streaks.

## Dashboard 3.0

The dashboard uses authenticated-user data only. It shows total assets, tracked savings, cash, investments, property, crypto, business, trading accounts, goal progress, active goals, pending OCR reviews, notifications requiring review, latest backup verification, asset allocation, portfolio growth, recent assets, recent receipts, latest entries, recent timeline events, and daily savings.

Goal progress and portfolio cards use the configured primary goal currency only. The app does not perform foreign-exchange conversion yet, so values in other currencies are stored and shown separately.

## Portfolio Engine

Assets are generic records grouped into `cash`, `investment`, `crypto`, `property`, `business`, `trading_account`, `vehicle`, or `other`. Each category can contain unlimited assets. Supported statuses are `active`, `sold`, `closed`, and `archived`.

Every asset value change appends an `asset_value_history` row. The latest asset `current_value` is updated for fast dashboard reads, but previous values are never overwritten or removed.

## Digital Vault And OCR

The digital vault stores metadata in PostgreSQL and file content on local disk. Supported folders are receipts, certificates, passports, land documents, company documents, tax documents, trading statements, insurance, and other. Documents support upload, preview, download, delete, tags, notes, and search.

OCR uses an EasyOCR worker. OCR jobs run against existing receipts or vault documents, store extracted text, confidence scores, amount candidates, and parsed amount/date/time/reference/recipient/sender as separate review rows, and require user confirmation before the OCR result is marked confirmed. OCR never overwrites the original uploaded file.

## Goals, Timeline, Notifications, And Backups

Users can track multiple financial goals in supported currencies. Goals support deadlines, progress sources, a single active primary goal, and append-only contributions. The unified timeline aggregates real entries, assets, value changes, receipts, vault documents, OCR results, goals, contributions, notifications, and backup runs.

Notifications are stored in-app. Telegram delivery is optional and disabled by default until `TELEGRAM_NOTIFICATIONS_ENABLED`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_CHAT_ID` are configured.

Owner-only backup endpoints manage backup settings, manual backup runs, dry runs, and restore verification. API-created backups write ZIP archives under `data/backups`, include a manifest, and verify file checksums. The Raspberry Pi systemd timer runs `deploy/backup.sh`, which creates PostgreSQL dump backups. `deploy/restore.sh` verifies archives and requires explicit confirmation before live restore.

## Receipt Vault

Receipts and payment screenshots can be uploaded as JPEG, PNG, WebP, or PDF files. Uploads are checked by MIME type, extension, file signature, configured size limit, and SHA-256 checksum. Duplicate receipts are detected per user. The API stores metadata in PostgreSQL and file contents on disk under `data/receipts/<user_uuid>/<year>/<month>/`.

Direct filesystem paths are never returned by the API. Receipt content is available only through authenticated owner-checked download and preview endpoints.

## Storage Layout

Runtime data is ignored by Git and stored under:

```text
data/
  assets/
  vault/
  receipts/
  ocr/
  backups/
```

Backups include the database dump, receipt files, asset files, vault files, OCR artifacts, and non-secret recovery configuration.

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

## Raspberry Pi RC1

RC1 version metadata is `1.0.0-rc.1`. Run the Raspberry Pi preflight before deployment:

```bash
./deploy/preflight-pi.sh
```

Operational commands and the release checklist are documented in `docs/RASPBERRY_PI_OPERATIONS.md` and `docs/RELEASE_CHECKLIST.md`. If this repository has no remote configured, connect a private GitHub repository with:

```bash
git remote add origin git@github.com:<owner>/<private-repository>.git
git push -u origin release/v1.0-rc1
```

Do not tag `v1.0.0-rc.1` until Raspberry Pi runtime validation succeeds.

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
ruff check .
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
npm audit --omit=dev
```

## Roadmap

The detailed milestone plan is in `ROADMAP.md`.
