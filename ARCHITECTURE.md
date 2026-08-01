# Architecture

Observer Wealth Intelligence is a private FastAPI and Next.js application backed by PostgreSQL.

## Backend

The backend is under `backend/app`:

- `api/routes/auth.py` exposes setup, registration, login, refresh, logout, and current-user endpoints.
- `api/routes/assets.py` exposes generic asset CRUD, asset value history, and asset document upload.
- `api/routes/automation.py` exposes owner-only backup schedule, manual backup, backup listing, and verification endpoints.
- `api/routes/dashboard.py` exposes authenticated wealth summary data.
- `api/routes/entries.py` exposes authenticated wealth-entry CRUD.
- `api/routes/goals.py` exposes financial goals and append-only goal contributions.
- `api/routes/notifications.py` exposes in-app notifications and read state.
- `api/routes/ocr.py` exposes OCR job creation, result reads, and explicit confirmation.
- `api/routes/portfolio.py` exposes portfolio summary calculations.
- `api/routes/receipts.py` exposes authenticated receipt metadata and content access.
- `api/routes/search.py` exposes global authenticated search.
- `api/routes/users.py` exposes authenticated profile and password operations.
- `api/routes/vault.py` exposes digital vault folders and document operations.
- `api/routes/settings.py` exposes authenticated settings reads and owner-only settings changes.
- `api/routes/timeline.py` exposes the unified wealth timeline.
- `models/` contains SQLAlchemy models for users, refresh sessions, app settings, audit logs, wealth entries, receipts, assets, asset value history, vault documents, OCR results, financial goals, goal contributions, notifications, automation jobs, and backup runs.
- `services/` contains authentication, session, settings, audit, rate-limit, wealth-entry, dashboard, receipt-storage, asset, portfolio, vault, OCR, search, goal, notification, automation, backup, and timeline logic.
- Alembic migrations live under `backend/alembic/versions`.

## Authentication Flow

1. A fresh installation reports `owner_exists=false` from `/api/v1/auth/setup-status`.
2. `/setup` creates the first account through `/api/v1/auth/register`.
3. The first account is assigned role `owner`.
4. `registration_enabled` is set to `false` after owner creation.
5. Login returns user metadata and sets HTTP-only access and refresh cookies.
6. The frontend never displays or stores JWT values in local storage.

## Token And Session Lifecycle

- Access tokens are short-lived JWTs signed with `SECRET_KEY`.
- Refresh tokens are random secret values. Only HMAC-SHA256 hashes are stored.
- Each access token includes the refresh-session id.
- Protected requests verify that the user is active and the refresh session has not been revoked.
- `/api/v1/auth/refresh` rotates the refresh token and CSRF token.
- Reuse of a revoked refresh token revokes all active sessions for that user.
- Password changes revoke all refresh sessions and require login again.
- Logout revokes the current refresh session and clears cookies.

## CSRF And Cookies

State-changing authenticated requests require `X-CSRF-Token` to match the readable CSRF cookie. Access and refresh cookies are HTTP-only. In production behind HTTPS, set `COOKIE_SECURE=true`.

## Profile

Users can update display name, email, timezone, preferred reporting currency, and password. Email changes require password confirmation. Password changes require the current password and revoke sessions.

## Settings

Application settings are stored in the singleton `app_settings` row. Owner-only changes are audited. Allocation percentages must total exactly 100%.

Defaults:

- `registration_enabled=false`
- `default_timezone=Europe/London`
- `default_currency=GBP`
- `savings_percentage=50`
- `business_percentage=30`
- `living_percentage=20`
- `primary_goal_amount=100000`
- `primary_goal_currency=GBP`
- `receipt_ocr_enabled=true`
- `theme_preference=system`

## Daily Entry Lifecycle

1. The client sends realised profit, currency, income source, optional historical date, actual allocation amounts, transfer confirmation, optional notes, optional receipt id, duplicate confirmation, future-date confirmation, and an idempotency key.
2. The server chooses the authoritative `recorded_at` timestamp in UTC and defaults `entry_date` from the authenticated user's timezone when no date is supplied.
3. Future-dated entries require `future_confirmed=true`.
4. Multiple entries per date are allowed, but a second `forex` entry on the same date requires `duplicate_confirmed=true`.
5. The allocation service reads the current savings, business, and living percentages from settings, stores those percentages on the entry, and calculates recommendations with decimal-safe two-place rounding.
6. Actual savings are stored as the total source of truth, including any amount above the recommended target.
7. Create, update, and delete operations write audit events without recording exact financial values or sensitive notes in the event metadata.

For zero-profit or negative-profit entries, recommended savings, business, and living amounts are `0.00`. These entries receive `status=no_savings_required` and no discipline score.

## Discipline Scoring

Discipline scoring is deterministic:

- `100` when actual savings are at least the recommendation and the recommendation is positive.
- `80` when actual savings are at least 80% of a positive recommendation.
- `50` when actual savings are at least 50% of a positive recommendation.
- `25` when actual savings are positive but below 50% of a positive recommendation.
- `0` when actual savings are zero and the recommendation is positive.
- `null` when no savings are required.

Statuses are `above_target`, `target_met`, `below_target`, and `no_savings_required`.

## Receipt Storage

Receipt metadata lives in PostgreSQL, while receipt bytes are stored on the local filesystem. The default path is `data/receipts/<user_uuid>/<year>/<month>/<generated_filename>`.

Uploads validate MIME type, extension, file signature, configured maximum size, and SHA-256 checksum. The original filename is retained only as metadata; generated internal filenames are used for storage. Duplicate checksum detection is scoped to the authenticated user. API responses expose metadata and authenticated content URLs, not filesystem paths.

Each receipt can be attached to at most one wealth entry. Deleting an entry leaves receipt metadata intact. Deleting a receipt detaches it from any entry, removes the local file when present, marks the receipt deleted, and writes an audit event.

## Portfolio Architecture

The portfolio engine is generic. An `asset` belongs to one user, has a category, name, currency, purchase price, current value, optional exchange-rate placeholder, purchase date, institution, reference, notes, and status.

Supported asset categories are:

- `cash`
- `investment`
- `crypto`
- `property`
- `business`
- `trading_account`
- `vehicle`
- `other`

Supported statuses are `active`, `sold`, `closed`, and `archived`.

Value history is append-only. Creating an asset writes the first `asset_value_history` row. Updating `current_value` through either the asset update endpoint or value-history endpoint writes a new history row with previous value, new value, currency, valuation date, source, notes, and recorded timestamp. Existing history is never rewritten.

For Dashboard 2.0 and portfolio summaries, active assets in the primary goal currency are aggregated by category. Tracked savings in the primary goal currency are included in cash and total assets. Other currencies are stored and shown separately; no FX conversion is performed.

## Digital Vault Architecture

The digital vault uses a `vault_documents` table for metadata and local filesystem storage for file content. Folders are `receipts`, `certificates`, `passports`, `land_documents`, `company_documents`, `tax_documents`, `trading_statements`, `insurance`, and `other`.

Vault documents store original filename, generated encrypted filename, media type, size, SHA-256/checksum, upload timestamp, tags, notes, and optional `asset_id`. API responses never include filesystem paths. The generated encrypted filename is a random internal name, not the user's original filename.

Asset-attached documents use the same metadata table with `storage_area=asset`, and are stored under the asset storage root. General vault documents use `storage_area=vault`.

## OCR Architecture

OCR is a review-first foundation. Jobs run against an existing receipt or vault document. The OCR service validates ownership, reads the source file from secure storage, calls the EasyOCR adapter, extracts text, parses amount, currency, date, time, and reference, and writes an `ocr_results` row with `status=pending_review`.

Confirmation is explicit through the OCR confirmation endpoint. Confirming an OCR result updates only the OCR result row. It does not mutate receipts, vault documents, entries, or assets. The original uploaded file is never overwritten.

OCR extracted text artifacts are written under `data/ocr/` for recovery and debugging. The API does not expose OCR artifact filesystem paths.

## Goals And Timeline Architecture

Financial goals are stored in `financial_goals`. Contributions are append-only rows in `goal_contributions`; adding a contribution updates the goal `current_amount` for fast dashboard reads. Contribution currency must match the goal currency until FX conversion is implemented.

The unified timeline is computed from existing records instead of duplicating history. It aggregates wealth entries, assets, asset value history, receipts, vault documents, OCR results, goals, goal contributions, notifications, and backup runs, sorted by occurrence time.

## Notification Architecture

Notifications are stored in `notifications`. In-app notifications default to `unread`, support read/read-all operations, and are owner-scoped by user id. Optional Telegram delivery is disabled by default and only runs when Telegram settings are present. Telegram delivery failures are stored on the notification row and do not block the in-app notification.

## Automation And Backup Architecture

Automation jobs are stored in `automation_jobs`. Milestone 5 includes the `scheduled_backup` job, owner-only schedule changes, and owner-only manual backup runs.

Application-level backup runs are stored in `backup_runs`. The API backup creates a ZIP archive under `data/backups`, writes a manifest, records SHA-256 and size metadata, and verifies every archived file checksum without restoring over live data. The API backup does not run `pg_dump`; Raspberry Pi and production database dumps are handled by `deploy/backup.sh`.

The Raspberry Pi deployment includes `observer-wealth-backup.service` and `observer-wealth-backup.timer` for scheduled shell backups.

## Global Search

Global search is owner-scoped and searches asset names, notes, institutions, references, receipt filenames, vault filenames, vault tags, vault notes, and vault folder names.

## Dashboard And Streaks

Daily-savings dashboard totals use `actual_savings`, not recommended savings. Dashboard 3.0 adds total assets, cash, investments, property, crypto, business, trading accounts, asset allocation, portfolio growth, recent assets, recent receipts, active goals, pending OCR reviews, unread notifications, recent notifications, recent timeline events, and latest backup verification status. The primary goal progress calculation only includes entries and assets in `primary_goal_currency`; there is no foreign-exchange conversion in this milestone.

The savings streak counts consecutive eligible saving days on which every positive-profit entry for that date met or exceeded the target. Weekends and days without entries do not automatically break the streak. Losing, zero-profit, and no-trade days are ignored. A positive-profit day with any below-target entry breaks the streak.

## Audit Logging

Audit records are written for login, logout, password change, and settings change. Login failures are recorded with a hash of the attempted email.

## Password Reset Limitation

Email-based password reset is intentionally not included in this private first release. Safe recovery requires local administrator access:

1. Stop public access to the service.
2. Generate a new Argon2 hash locally with `backend/app/core/security.py`.
3. Update the owner `password_hash` directly in PostgreSQL.
4. Revoke rows in `refresh_sessions` for the owner.
5. Log in locally and change the password through `/profile`.

No recovery password should be committed to source control or left in shell history.
