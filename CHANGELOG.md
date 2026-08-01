# Changelog

## 1.0.0-rc.1 - 2026-08-01

### Added

- Raspberry Pi RC1 preflight script with architecture, OS, RAM, disk, Docker, Compose, timezone, ports, storage, systemd, backup, and internet checks.
- Release candidate metadata through `VERSION`, frontend package metadata, `.env.example`, and backend health responses.
- RC1 operational documentation for Raspberry Pi deployment, backup and restore, OCR, PWA, security, troubleshooting, release checklist, release notes, migration summary, known limitations, upgrade instructions, and rollback guidance.

### Changed

- Backend container now runs as a non-root `owi` user.
- Raspberry Pi installer prepares runtime storage ownership for the backend and OCR worker container user.

### Validation Status

- Local lint, typing, tests, build, audit, and Compose checks must pass before the RC branch is reviewed.
- Raspberry Pi runtime validation, real ARM64 OCR execution, PWA install checks, systemd timer checks, backup restore drill, reboot recovery, and performance measurements must be completed on the target device before creating tag `v1.0.0-rc.1`.
