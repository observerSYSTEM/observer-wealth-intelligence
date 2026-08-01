# Notifications Architecture

Notifications are stored in PostgreSQL and scoped to the authenticated user. In-app notifications are always available. Telegram delivery is optional and requires both global environment configuration and per-user notification preference opt-in.

Notification preferences control Telegram, daily reminders, weekly summaries, goal alerts, OCR alerts, backup alerts, quiet hours, and timezone. Telegram test sends are rate-limited and record the result as a notification row.

Duplicate reminders and system notices use `deduplication_key` so repeated scheduler runs do not create duplicate user-visible notifications.

Primary endpoints:

- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/{notification_id}/read`
- `POST /api/v1/notifications/read-all`
- `POST /api/v1/notifications/test-telegram`
- `GET /api/v1/notification-preferences`
- `PATCH /api/v1/notification-preferences`
