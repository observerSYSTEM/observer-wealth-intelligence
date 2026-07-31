# Environment

| Variable | Required | Description |
| --- | --- | --- |
| `APP_NAME` | No | API title shown in OpenAPI metadata. |
| `ENVIRONMENT` | No | `development`, `test`, or `production`. |
| `SECRET_KEY` | Yes in production | JWT signing secret. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | JWT access token lifetime. |
| `DATABASE_URL` | Yes | SQLAlchemy PostgreSQL connection string. |
| `POSTGRES_DB` | No | PostgreSQL database name used by Docker Compose. |
| `POSTGRES_USER` | No | PostgreSQL user used by Docker Compose. |
| `POSTGRES_PASSWORD` | No | PostgreSQL password used by Docker Compose. |
| `CORS_ORIGINS` | No | JSON array of allowed browser origins. |
| `NEXT_PUBLIC_API_URL` | No | Browser-visible API base URL. Empty value uses same origin. |
| `BACKUP_DIR` | No | Directory used by backup script. |
