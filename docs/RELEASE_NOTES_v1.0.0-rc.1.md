# Observer Wealth Intelligence v1.0.0-rc.1 Release Notes

This release candidate prepares OWI v1.0 for Raspberry Pi 5 validation. It does not add product features beyond the approved Milestone 5 scope.

## Scope

- Runtime validation and release readiness for Raspberry Pi 5 ARM64.
- Non-root backend container execution.
- Preflight checks for Pi deployment.
- Operational documentation for install, backup, restore, OCR, PWA, troubleshooting, and security review.
- Release metadata set to `1.0.0-rc.1`.

## Migration Summary

The current head migration is `20260801_0005`. It includes automation, goals, notifications, backup settings, timeline events, and expanded OCR review fields. A clean database must migrate from the initial revision through `20260801_0005` with `alembic upgrade head`.

## Known Limitations

- No AI financial analysis.
- No FX conversion.
- No bank connections or external investment APIs.
- API-created ZIP backups do not include PostgreSQL dumps; shell backups do.
- Real OCR speed and memory behavior depend on first-run EasyOCR model download and Pi storage performance.
- iOS PWA behavior depends on Safari platform support.

## Upgrade

1. Back up the existing database and `data/` directory.
2. Pull the release branch.
3. Review `.env.example` for new variables.
4. Run `docker compose -f docker-compose.yml -f docker-compose.pi.yml build`.
5. Run `docker compose -f docker-compose.yml -f docker-compose.pi.yml up -d`.
6. Confirm `/api/v1/health` returns version `1.0.0-rc.1`.

## Rollback

1. Stop the RC stack.
2. Restore the previous Git commit or image set.
3. Restore the database and runtime files from the pre-upgrade backup if migrations were applied.
4. Start the previous stack and validate owner login before exposing the app again.

Do not create tag `v1.0.0-rc.1` until all required Raspberry Pi validation gates pass.
