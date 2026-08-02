# OWI v1.0 Acceptance Test

Target release branch: `release/v1.0-rc1`

Known working Raspberry Pi deployment:

```text
http://192.168.0.86:8080
```

Do not tag `v1.0.0` until this checklist is complete and defects are either fixed or explicitly accepted.

## Ground Rules

- Run acceptance against a disposable or intentionally approved owner account.
- Do not paste secrets into the terminal, issue tracker, screenshots, or commit messages.
- Use real test uploads only when they are safe to store temporarily on the Pi.
- Delete any acceptance-only entries, receipts, documents, goals, and assets before approval.
- Leave `INCLUDE_SECRETS_IN_BACKUP=false` unless the backup destination is encrypted and explicitly approved.

## Pi Baseline Commands

Run on the Raspberry Pi from the deployment directory:

```bash
cd /opt/observer-wealth-intelligence
git branch --show-current
git log -1 --oneline
git status --short
OWI_BASE_URL=http://192.168.0.86:8080 ./deploy/diagnostics.sh
```

Expected:

- Branch is `release/v1.0-rc1`.
- Working tree is clean.
- Health is `ok`, database is `ok`, and app version is `1.0.0-rc.1`.
- `deploy/diagnostics.sh` does not print secret values.

## Browser Route Sweep

Open `http://192.168.0.86:8080` in a desktop browser and a mobile-width viewport. Confirm each route loads without a hard refresh error, blank screen, or console exception:

| Route | Workflow |
| --- | --- |
| `/login` | Login page, expired-session message, dark-mode toggle. |
| `/setup` | Redirects to login when owner exists. |
| `/dashboard` and `/` | Dashboard cards, allocation, charts, recent items, backup state. |
| `/entries/new` | Daily entry creation. |
| `/entries` | Entry history, filters, edit/delete navigation. |
| `/receipts` | Receipt upload, preview, download, OCR queue, delete. |
| `/portfolio` | Portfolio totals and allocation. |
| `/assets` | Asset list, category/status filters, archive. |
| `/assets/new` | Asset creation. |
| `/assets/[id]` | Asset details, value history, document upload/download. |
| `/goals` | Goal list, quick contribution, archive. |
| `/goals/new` | Goal creation. |
| `/goals/[id]` | Goal detail, contribution history, delete contribution. |
| `/timeline` | Unified wealth timeline. |
| `/vault` | Folder list and global vault search. |
| `/vault/[folder]` | Upload, preview, download, delete, tags, notes, OCR queue. |
| `/ocr` | Review queue. |
| `/ocr/[id]` | Review detail, confirm, retry, cancel. |
| `/notifications` | Preferences, read/unread actions, optional Telegram test. |
| `/automation` | Backup schedule, manual backup, verification. |
| `/settings` | Allocation and app settings. |
| `/profile` | Profile update, password change. |

## Auth And Session Commands

Run from the Pi. These commands keep credentials out of shell history by prompting for them:

```bash
cd /opt/observer-wealth-intelligence
BASE_URL=http://192.168.0.86:8080
COOKIE_JAR="$(mktemp)"

curl -fsS "$BASE_URL/api/v1/health" | python3 -m json.tool
curl -fsS "$BASE_URL/api/v1/auth/setup-status" | python3 -m json.tool

read -r -p "Owner email: " OWI_EMAIL
read -r -s -p "Owner password: " OWI_PASSWORD
printf '\n'
export OWI_EMAIL OWI_PASSWORD
LOGIN_BODY="$(python3 -c 'import json, os; print(json.dumps({"email": os.environ["OWI_EMAIL"], "password": os.environ["OWI_PASSWORD"]}))')"
unset OWI_PASSWORD

curl -fsS -c "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  -d "$LOGIN_BODY" \
  "$BASE_URL/api/v1/auth/login" | python3 -m json.tool
unset LOGIN_BODY OWI_EMAIL

curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/v1/auth/me" | python3 -m json.tool
curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/v1/dashboard/summary" | python3 -m json.tool >/tmp/owi-dashboard-summary.json
CSRF_TOKEN="$(awk '$6 == "owi_csrf_token" {print $7}' "$COOKIE_JAR" | tail -n 1)"
curl -fsS -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -X POST \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  "$BASE_URL/api/v1/auth/refresh" | python3 -m json.tool
```

Expected:

- Login returns `200`.
- `/api/v1/auth/me` returns `200` immediately after login.
- `/api/v1/dashboard/summary` returns `200`.
- Refresh returns `200` and keeps the session authenticated.

Logout check:

```bash
CSRF_TOKEN="$(awk '$6 == "owi_csrf_token" {print $7}' "$COOKIE_JAR" | tail -n 1)"
curl -fsS -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -X POST \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  "$BASE_URL/api/v1/auth/logout" | python3 -m json.tool
curl -sS -o /tmp/owi-auth-me-after-logout.txt -w "%{http_code}\n" \
  -b "$COOKIE_JAR" \
  "$BASE_URL/api/v1/auth/me"
rm -f "$COOKIE_JAR"
```

Expected:

- Logout returns `200`.
- The final `/auth/me` check prints `401`.

## Workflow Acceptance Checklist

### Owner Registration

- On a fresh disposable database only, visit `/setup`.
- Create the first owner.
- Confirm `/api/v1/auth/setup-status` reports `owner_exists=true` and `registration_enabled=false`.
- Confirm `/setup` redirects to `/login` after owner creation.

### Login, Logout, Session Persistence

- Sign in through `/login`.
- Refresh the browser on `/dashboard`; the user remains authenticated.
- Close and reopen the browser tab; the user remains authenticated while cookies are valid.
- Run the refresh command above; `/auth/me` remains `200`.
- Log out; protected routes redirect to `/login`.

### Expired Session Handling

- In browser dev tools, delete `owi_access_token` and `owi_refresh_token`, then open `/dashboard`.
- Expected: user is redirected to `/login` with an expired-session message.
- Stop the backend container briefly and load a protected route.
- Expected: user sees an API unavailable message, not a blank screen.

### Daily Entry Creation, Edit, Delete

- Create a daily entry from `/entries/new`.
- Confirm allocation fields are shown before saving.
- Confirm the entry appears in `/entries`, `/dashboard`, and `/timeline`.
- Edit the entry from `/entries/[id]`.
- Delete the entry and confirm totals/timeline update.
- Submit invalid form data and confirm the UI shows a form-validation error.

### Receipt Upload, Download, Delete

- Upload a PNG, JPEG, WebP, or PDF receipt from `/receipts`.
- Confirm upload progress and success message.
- Preview and download the original.
- Confirm no filesystem path is exposed in the API response or UI.
- Upload the same file again and confirm duplicate detection is user-facing.
- Delete the receipt and confirm it disappears from the list.

### Asset Creation, History, Documents

- Create one asset from `/assets/new`.
- Open `/assets/[id]` and update its current value.
- Confirm value history appends a new row rather than overwriting the previous one.
- Upload an asset document.
- Preview/download the document and confirm no storage path is exposed.
- Archive the asset from `/assets` and confirm it no longer appears as active.

### Goal Creation And Contributions

- Create a goal from `/goals/new`.
- Add a contribution from `/goals` or `/goals/[id]`.
- Confirm progress changes and contribution history appends.
- Delete a contribution and confirm progress recalculates.
- Archive the goal and confirm dashboard goal state remains coherent.

### Vault Document Workflows

- Open `/vault`.
- Search for a known document or term.
- Open each folder at least once:
  - receipts
  - certificates
  - passports
  - land_documents
  - company_documents
  - tax_documents
  - trading_statements
  - insurance
  - other
- Upload a document with tags and notes.
- Search within the folder.
- Preview, download, delete, and confirm deletion.

### OCR Job, Review, Confirmation

- Queue OCR from a receipt or vault document.
- Confirm an OCR result appears in `/ocr`.
- Open `/ocr/[id]`.
- Confirm extracted amount/date/time/reference candidates are review-only before confirmation.
- Confirm the OCR result.
- Retry and cancel actions should show a clear user-facing error if the OCR worker is unavailable.

### Notifications

- Open `/notifications`.
- Toggle in-app preferences.
- Mark one notification read and use read-all.
- If Telegram is configured, run a test notification.
- If Telegram is not configured, confirm the UI reports a clear skipped/failed status.

### Backups, Verification, Restore Drill

Run from the Pi:

```bash
cd /opt/observer-wealth-intelligence
INCLUDE_SECRETS_IN_BACKUP=false ./deploy/backup.sh
LATEST_BACKUP="$(ls -t data/backups/*.tar.gz | head -n 1)"
./deploy/verify-backup.sh "$LATEST_BACKUP"
./deploy/restore.sh "$LATEST_BACKUP" --verify-only
./deploy/restore.sh "$LATEST_BACKUP" --dry-run
tar -tzf "$LATEST_BACKUP" | grep -E '(^|/)\.env$' && echo "FAIL: .env included" || echo "PASS: .env excluded"
```

Expected:

- Backup succeeds.
- Verification succeeds.
- Restore verify-only and dry-run succeed.
- `.env` is not included when `INCLUDE_SECRETS_IN_BACKUP=false`.

### Mobile Layout

- Use a mobile device or browser responsive mode at 390px width.
- Confirm the sidebar collapses, bottom navigation works, text does not overlap, and major workflows remain reachable.
- Test dashboard, entries, receipts, assets, goals, vault folder, OCR detail, automation, settings, and profile.

### Dark Mode

- Toggle dark mode from login and authenticated routes.
- Refresh the page and confirm preference persists.
- Check dashboard charts, forms, file uploaders, dialogs, and error messages for readable contrast.

### PWA Installation

- Open the site in Chromium or Android Chrome.
- Confirm install prompt or browser install option is available.
- Install the PWA.
- Launch from the installed icon.
- While offline, confirm read-only cached routes show safe cached data or the offline page.
- While offline, confirm write actions are blocked with a clear offline message.

### Raspberry Pi Reboot Recovery

Run from the Pi:

```bash
sudo reboot
```

After the Pi returns:

```bash
cd /opt/observer-wealth-intelligence
sudo systemctl status observer-wealth-intelligence --no-pager
sudo systemctl status observer-wealth-backup.timer --no-pager
docker compose -f docker-compose.yml -f docker-compose.pi.yml ps
curl -fsS http://192.168.0.86:8080/api/v1/health | python3 -m json.tool
OWI_BASE_URL=http://192.168.0.86:8080 ./deploy/diagnostics.sh
```

Expected:

- App service is active.
- Backup timer is active.
- Containers are healthy/running.
- Health endpoint returns `ok`.
- Login still works after reboot.

## Acceptance Sign-Off

Record:

- Commit hash under test.
- Browser and device used.
- Pi model, OS, Docker version, and available disk space.
- Pass/fail for each workflow.
- Any accepted defects with owner approval.
- Backup archive name used for restore drill.
