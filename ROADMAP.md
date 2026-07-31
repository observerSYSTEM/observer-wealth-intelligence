# Roadmap

## Milestone 1: Project Architecture

- Backend application architecture with FastAPI, SQLAlchemy, Alembic, PostgreSQL, and JWT security primitives.
- Frontend application architecture with Next.js, TypeScript, Tailwind, responsive dashboard layout, and light/dark modes.
- Docker, development, production, Raspberry Pi, systemd, backup, update, documentation, and CI configuration.

## Milestone 2: Authentication, User Profile, Settings

- Complete account lifecycle flows.
- User profile API and UI.
- Settings storage and management.

## Milestone 3: Dashboard, Wealth Cards, Charts

- Wealth overview API.
- Dashboard wealth cards.
- Chart components backed by persisted records.

## Milestone 4: Daily Savings, 50/30/20 Calculator, Auto Date/Time

- Daily saving records.
- 50/30/20 calculation service.
- Timezone-aware date and time handling.

## Milestone 5: Receipt Upload, OCR, Duplicate Detection

- Receipt upload pipeline.
- OCR extraction.
- Duplicate detection using file hashing and persisted metadata.

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
