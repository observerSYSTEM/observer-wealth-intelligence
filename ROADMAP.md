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

## Milestone 4: Portfolio Engine, OCR Foundation, Digital Vault

- Generic portfolio asset system across cash, investments, crypto, property, business, trading accounts, vehicles, and other assets.
- Append-only asset value history and asset document support.
- Digital vault folders with upload, preview, download, delete, tags, notes, search, owner isolation, and checksum duplicate detection.
- OCR foundation using EasyOCR with amount, date, time, reference extraction and explicit review/confirmation.
- Dashboard 2.0 with total assets, category cards, asset allocation, portfolio growth, recent assets, recent receipts, tracked savings, and goal progress.
- Multi-currency storage for GBP, USD, NGN, and EUR with exchange-rate placeholders and no FX conversion.

## Milestone 5: OCR Intelligence And Duplicate Review

- OCR-assisted receipt review improvements.
- Stronger duplicate detection using confirmed OCR metadata.
- Optional linking from confirmed OCR results into entries, assets, or vault records.

## Milestone 6: Integrations And Asset Sources

- Source-specific workflows for Monzo, BluNest, Vanguard, USDT, land, and business holdings.
- Manual import helpers and source metadata without storing banking credentials.
- Daily savings automation and reminders.

## Milestone 7: Reports, CSV, PDF

- CSV exports.
- PDF reports.
- Report generation audit trail.

## Milestone 8: Raspberry Pi Optimization, PWA, Offline Support, Daily Backups

- Runtime optimization for Raspberry Pi.
- PWA installation support.
- Offline read support for selected screens.
- Scheduled daily backups.
