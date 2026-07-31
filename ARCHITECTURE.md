# Architecture

Observer Wealth Intelligence is a private FastAPI and Next.js application backed by PostgreSQL.

## Backend

The backend is under `backend/app`:

- `api/routes/auth.py` exposes setup, registration, login, refresh, logout, and current-user endpoints.
- `api/routes/users.py` exposes authenticated profile and password operations.
- `api/routes/settings.py` exposes authenticated settings reads and owner-only settings changes.
- `models/` contains SQLAlchemy models for users, refresh sessions, app settings, and audit logs.
- `services/` contains authentication, session, settings, audit, and rate-limit logic.
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
