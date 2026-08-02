# Security Review

## Critical

- None known from local static review.
- Must remain empty before RC1 tag.

## High

- None known from local static review.
- Must remain empty before RC1 tag.

## Medium

- Raspberry Pi runtime security has not been validated in this Windows workspace. Validate container users, exposed ports, systemd units, logs, file permissions, and Docker privileges on-device.
- Telegram runtime behavior requires test credentials supplied only through environment variables.

## Low

- API ZIP backups do not contain PostgreSQL dumps. This is documented and shell backups cover database recovery.
- iOS PWA storage behavior may vary by Safari version.

## Informational

- Backend and OCR worker containers run as the non-root UID/GID configured by `PUID` and `PGID`, defaulting to `10001:10001` when unset.
- Frontend container runs as non-root `nextjs`.
- PostgreSQL and Nginx use official upstream images. Any root-owned startup behavior in those images must be verified on the Pi and documented from `docker compose exec <service> id`.
- Auth tokens are stored in HTTP-only cookies.
- CSRF uses a readable token cookie plus `X-CSRF-Token`.
- PWA service worker excludes API routes and binary content from generic cache handling.

## Required RC1 Tests

- Authentication cookies.
- CSRF failures.
- CORS origin enforcement.
- JWT and refresh-session rotation.
- Owner-only backup endpoints.
- Object ownership isolation.
- MIME and signature upload validation.
- Disguised executable rejection.
- Path traversal rejection.
- Oversized upload rejection.
- PDF abuse controls.
- Duplicate receipt checks.
- Rate limits.
- Audit logging.
- Secret redaction in logs and backups.
- PWA cache privacy.
- Docker privileges and exposed ports.

Run dependency checks:

```bash
cd backend
python -m pip_audit

cd ../frontend
npm audit --omit=dev
```

If `pip_audit` is unavailable, install and run it on the Pi or in CI before RC approval.
