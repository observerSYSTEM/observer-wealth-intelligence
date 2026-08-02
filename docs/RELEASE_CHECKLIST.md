# OWI v1.0 RC1 Release Checklist

Branch: `release/v1.0-rc1`
Version: `1.0.0-rc.1`
Required tag after successful validation only: `v1.0.0-rc.1`

## Repository

- Confirm HEAD is based on approved commit `dac3a11`.
- Confirm working tree is clean.
- Confirm `.env` is ignored.
- Confirm no secrets are staged.
- Run a tracked-file secret scan before tagging.
- If a private GitHub remote is needed, use:

```bash
git remote add origin git@github.com:<owner>/<private-repository>.git
git push -u origin release/v1.0-rc1
```

Do not invent or commit a remote URL.

## Local Gates

```bash
cd backend
ruff check .
python -m compileall app alembic
mypy app
pytest

cd ../frontend
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev

cd ..
export SECRET_KEY="rc1-validation-secret-rc1-validation-secret"
export POSTGRES_PASSWORD="rc1-validation-postgres-password"
export DATABASE_URL="postgresql+psycopg://observer:rc1-validation-postgres-password@db:5432/observer_wealth"
docker compose -f docker-compose.yml config
docker compose -f docker-compose.yml -f docker-compose.pi.yml config
```

## Raspberry Pi Gates

Run on Raspberry Pi 5:

```bash
./deploy/preflight-pi.sh
docker compose -f docker-compose.yml -f docker-compose.pi.yml build
docker compose -f docker-compose.yml -f docker-compose.pi.yml up -d
docker compose -f docker-compose.yml -f docker-compose.pi.yml ps
docker compose -f docker-compose.yml -f docker-compose.pi.yml logs --no-color --tail=200
```

Required before tag:

- All containers start.
- Health endpoint passes.
- Migrations complete.
- OCR worker processes real files.
- Backup timer works.
- Restore drill succeeds in disposable environment.
- PWA installs and offline read behavior is verified.
- No critical or high security findings remain.

## Tag Gate

Create the tag only after all required gates pass:

```bash
git tag -a v1.0.0-rc.1 -m "Observer Wealth Intelligence v1.0.0-rc.1"
git push origin v1.0.0-rc.1
```
