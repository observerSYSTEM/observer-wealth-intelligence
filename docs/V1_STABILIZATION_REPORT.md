# OWI v1.0 Stabilization Report

Branch: `release/v1.0-rc1`

Deployment under review:

```text
http://192.168.0.86:8080
```

## Scope

This stabilization pass prepares Observer Wealth Intelligence v1.0 for acceptance testing. It does not start OWI v2 and does not add AI analysis, FX conversion, external bank integrations, new asset classes, or financial-calculation changes.

## Live Deployment Smoke Check

The Raspberry Pi deployment responded successfully from the development workstation:

```text
GET /api/v1/health -> 200
status: ok
database: ok
environment: production
version: 1.0.0-rc.1

GET /api/v1/auth/setup-status -> 200
owner_exists: true
registration_enabled: false
```

Credentialed workflow acceptance is documented in `docs/V1_ACCEPTANCE_TEST.md` and must be run by the owner or an approved operator.

## Existing Route Review

Frontend route files exist for:

- `/`
- `/dashboard`
- `/entries`
- `/entries/new`
- `/entries/[id]`
- `/receipts`
- `/portfolio`
- `/assets`
- `/assets/new`
- `/assets/[id]`
- `/goals`
- `/goals/new`
- `/goals/[id]`
- `/timeline`
- `/vault`
- `/vault/[folder]`
- `/ocr`
- `/ocr/[id]`
- `/notifications`
- `/automation`
- `/settings`
- `/profile`
- `/login`
- `/setup`

Backend routers are mounted for:

- health
- auth
- users
- assets
- goals
- entries
- receipts
- vault
- dashboard
- OCR
- portfolio
- notifications
- automation
- backups
- notification preferences
- timeline
- search
- settings

## Dashboard Review

The dashboard was reviewed for genuine usability defects only. One release-label inconsistency was corrected: the dashboard eyebrow now reads `Dashboard 3.0`, matching the v1.0 release scope and documentation.

No dashboard financial calculations, portfolio summaries, allocation logic, or chart calculations were changed.

## User-Facing Error Handling

The frontend API error helper now provides clearer messages for:

- API unavailable or network failure.
- Expired authentication.
- Permission failure.
- Upload size failure.
- Invalid form data.
- Backend/server failure.

Targeted action contexts were added for:

- authentication
- form submission
- uploads
- OCR actions
- backup actions

Existing pages continue to use their current `FormMessage` surfaces; the change is deliberately small and avoids redesigning workflows.

## Sensitive Value Review

Current controls:

- `.env` is ignored and excluded from Docker build context.
- `.env.example` leaves secret-bearing values blank.
- Auth tokens are stored in HTTP-only cookies.
- Refresh tokens and CSRF tokens are persisted only as hashes.
- `INCLUDE_SECRETS_IN_BACKUP=false` excludes `.env` from shell backups.
- `deploy/diagnostics.sh` redacts common token, password, database URL, and cookie patterns from command output and logs.
- Frontend runtime uses same-origin API paths by default and does not require embedding backend secrets.

Acceptance must still confirm on the Pi:

```bash
git check-ignore -v .env
git ls-files .env
INCLUDE_SECRETS_IN_BACKUP=false ./deploy/backup.sh
LATEST_BACKUP="$(ls -t data/backups/*.tar.gz | head -n 1)"
tar -tzf "$LATEST_BACKUP" | grep -E '(^|/)\.env$' && echo "FAIL" || echo "PASS"
OWI_BASE_URL=http://192.168.0.86:8080 ./deploy/diagnostics.sh
```

Expected:

- `.env` is ignored.
- `.env` is not tracked.
- Backups exclude `.env`.
- Diagnostics output does not print secrets.

## Diagnostics Script

`deploy/diagnostics.sh` reports:

- current branch and commit
- health endpoints and app version
- container status
- database readiness
- disk usage
- storage directory permissions
- backup timer and recent backup files
- last 100 relevant redacted error log lines

The script is intended for Raspberry Pi operators and avoids printing `.env` or Docker Compose rendered configuration.

## Acceptance Plan

The production acceptance plan is in:

```text
docs/V1_ACCEPTANCE_TEST.md
```

It covers:

- owner registration
- login
- logout
- session persistence
- expired session handling
- daily entry creation, edit, and delete
- receipt upload, download, and delete
- asset creation, history, and documents
- goal creation and contributions
- vault document workflows
- OCR job, review, and confirmation
- notification preferences
- backup run, verification, and restore drill
- mobile layout
- dark mode
- PWA installation
- Raspberry Pi reboot recovery

## Unresolved Defects

No verified code defects remain from this stabilization pass.

Manual acceptance can still uncover environment-specific issues, especially:

- browser-specific PWA installation behavior
- OCR performance on large PDFs
- available disk space during backup/restore drills
- Telegram delivery when optional credentials are configured

## Validation Record

The release candidate should pass:

- `ruff`
- `mypy`
- `compileall`
- backend `pytest`
- frontend `npm run typecheck`
- frontend `npm run lint`
- frontend `npm run build`
- `npm audit --omit=dev`
- Docker Compose config validation for base, production, and Pi overlays
- `git diff --check`

The final command results for this stabilization commit are recorded in the assistant handoff message for the commit.
