# Environment

| Variable | Required | Description |
| --- | --- | --- |
| `APP_NAME` | No | API title shown in OpenAPI metadata. |
| `APP_VERSION` | No | Release version returned by the health endpoint. Default is `1.0.0-rc.1`. |
| `ENVIRONMENT` | No | `development`, `test`, or `production`. |
| `SECRET_KEY` | Yes | JWT signing secret. Required by Compose and intentionally blank in `.env.example`. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | JWT access token lifetime. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | Refresh-session lifetime. |
| `LOGIN_RATE_LIMIT_ATTEMPTS` | No | Failed login attempts allowed per window. |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | No | Login rate-limit window. |
| `RECEIPT_MAX_FILE_SIZE_BYTES` | No | Maximum accepted receipt upload size. Default is 10 MiB. |
| `RECEIPT_STORAGE_PATH` | No | Local filesystem path for receipt files. Default is `data/receipts`. |
| `ASSET_STORAGE_PATH` | No | Local filesystem path for asset-attached documents. Default is `data/assets`. |
| `VAULT_STORAGE_PATH` | No | Local filesystem path for digital vault documents. Default is `data/vault`. |
| `OCR_STORAGE_PATH` | No | Local filesystem path for OCR text artifacts. Default is `data/ocr`. |
| `BACKUP_STORAGE_PATH` | No | Local filesystem path for API-created backup archives. Default is `data/backups`. |
| `VAULT_MAX_FILE_SIZE_BYTES` | No | Maximum accepted digital-vault upload size. Default is 25 MiB. |
| `EASYOCR_LANGUAGES` | No | JSON list of EasyOCR language codes. Default is `["en"]`. |
| `TELEGRAM_NOTIFICATIONS_ENABLED` | No | Enables optional Telegram sends when set to `true`. |
| `TELEGRAM_BOT_TOKEN` | Telegram only | Telegram bot token for optional notifications. |
| `TELEGRAM_CHAT_ID` | Telegram only | Telegram chat id for optional notifications. |
| `BACKUP_SCHEDULE_ENABLED` | No | Initial scheduled backup job state. |
| `BACKUP_SCHEDULE_TIME` | No | Initial backup schedule time in `HH:MM`. |
| `COOKIE_SECURE` | HTTPS only | Forces auth cookies to use the Secure flag. Keep `false` for HTTP Raspberry Pi or localhost LAN deployments. |
| `COOKIE_SAMESITE` | No | Auth cookie SameSite policy. |
| `DATABASE_URL` | Yes | SQLAlchemy PostgreSQL connection string. Must use the same password as `POSTGRES_PASSWORD` for Compose deployments. |
| `POSTGRES_DB` | No | PostgreSQL database name used by Docker Compose. |
| `POSTGRES_USER` | No | PostgreSQL user used by Docker Compose. |
| `POSTGRES_PASSWORD` | Yes for Compose | PostgreSQL password used by Docker Compose. Required and intentionally blank in `.env.example`. |
| `CORS_ORIGINS` | No | JSON array of allowed browser origins. |
| `NEXT_PUBLIC_API_URL` | No | Browser-visible API origin. Empty value uses same origin; API path resolution is owned by `frontend/lib/api.ts`. |
| `BACKUP_DIR` | No | Directory used by backup script. |
| `BACKUP_RETENTION_COUNT` | No | Number of shell backup archives to keep in retention dry-run reports. |
| `INCLUDE_SECRETS_IN_BACKUP` | No | Includes `.env` in backup archives only when set to `true`. Use encrypted storage. |

Uploaded files, OCR artifacts, and backup archives should be stored on persistent disk. PostgreSQL backups do not include file bytes; the backup script copies `RECEIPT_STORAGE_PATH`, `ASSET_STORAGE_PATH`, `VAULT_STORAGE_PATH`, and `OCR_STORAGE_PATH` separately.

`.env` is ignored by git and must remain local to the deployment host. The install scripts generate `SECRET_KEY`, `POSTGRES_PASSWORD`, and `DATABASE_URL` when creating a new `.env`; manual installs must provide equivalent strong values before running Compose.
