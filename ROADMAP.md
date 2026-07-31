# Roadmap

## Milestone 1: Project Architecture

- Backend application architecture with FastAPI, SQLAlchemy, Alembic, PostgreSQL, and JWT security primitives.
- Frontend application architecture with Next.js, TypeScript, Tailwind, responsive dashboard layout, and light/dark modes.
- Docker, development, production, Raspberry Pi, systemd, backup, update, documentation, and CI configuration.

## Milestone 2: Authentication, User Profile, Settings

- First-owner setup and private registration flow.
- Cookie-backed login, logout, current user, access refresh, rotating refresh tokens, revocation, CSRF protection, and rate limiting.
- User profile API and UI for display name, email, timezone, preferred currency, and password changes.
- Owner-only application settings with allocation validation and audit logging.

## Milestone 3: Daily Savings, Dashboard, Receipt Vault

- Daily wealth-entry records for realised profit and actual savings.
- Settings-driven allocation calculation with historical percentages stored per entry.
- Timezone-aware local entry dates and authoritative UTC timestamps.
- Deterministic discipline scoring, status calculation, duplicate forex-date confirmation, and idempotent create requests.
- Authenticated dashboard with tracked savings, goal progress, latest entries, charts, and saving streaks.
- Receipt upload pipeline for JPEG, PNG, WebP, and PDF files with signature checks, maximum-size configuration, SHA-256 duplicate detection, owner-only access, and local filesystem storage.

## Milestone 4: OCR And Receipt Intelligence

- OCR extraction for uploaded receipts and Monzo screenshots.
- Manual review and correction workflow for extracted values.
- Stronger duplicate detection using extracted metadata where available.

## Milestone 5: Daily Savings Automation

- Scheduled reminders and daily review prompts.
- Additional date/time automation and reporting conveniences.
- Refinements to the allocation workflow based on real usage.

## Milestone 6: Asset Tracker

- Asset tracking for Monzo, BluNest, Vanguard, USDT, land, and business holdings.
- Manual valuation history.
- Source-specific metadata without storing banking credentials.

## Milestone 7: Reports, CSV, PDF

- CSV exports.
- PDF reports.
- Report generation audit trail.

## Milestone 8: Raspberry Pi Optimization, PWA, Offline Support, Daily Backups

- Runtime optimization for Raspberry Pi.
- PWA installation support.
- Offline read support for selected screens.
- Scheduled daily backups.
