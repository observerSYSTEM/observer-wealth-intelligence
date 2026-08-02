#!/usr/bin/env sh
set -eu

APP_USER="${APP_USER:-owi}"
APP_GROUP="${APP_GROUP:-owi}"
PUID="${PUID:-10001}"
PGID="${PGID:-10001}"

fail() {
  echo "OWI startup error: $*" >&2
  exit 1
}

is_numeric() {
  case "$1" in
    ''|*[!0-9]*) return 1 ;;
    *) return 0 ;;
  esac
}

resolve_storage_path() {
  case "$1" in
    /*) printf '%s\n' "$1" ;;
    *) printf '/app/%s\n' "$1" ;;
  esac
}

ensure_identity() {
  is_numeric "$PUID" || fail "PUID must be a non-root numeric user id."
  is_numeric "$PGID" || fail "PGID must be a non-root numeric group id."
  [ "$PUID" != "0" ] || fail "PUID must not be 0; OWI services run as a non-root user."
  [ "$PGID" != "0" ] || fail "PGID must not be 0; OWI services run as a non-root group."

  if getent group "$APP_GROUP" >/dev/null 2>&1; then
    current_gid="$(getent group "$APP_GROUP" | cut -d: -f3)"
    if [ "$current_gid" != "$PGID" ]; then
      groupmod -o -g "$PGID" "$APP_GROUP" \
        || fail "Unable to set ${APP_GROUP} group id to PGID=${PGID}."
    fi
  else
    groupadd -o -g "$PGID" "$APP_GROUP" \
      || fail "Unable to create ${APP_GROUP} group with PGID=${PGID}."
  fi

  if id "$APP_USER" >/dev/null 2>&1; then
    current_uid="$(id -u "$APP_USER")"
    current_user_gid="$(id -g "$APP_USER")"
    if [ "$current_uid" != "$PUID" ] || [ "$current_user_gid" != "$PGID" ]; then
      usermod -o -u "$PUID" -g "$PGID" "$APP_USER" \
        || fail "Unable to set ${APP_USER} user id to PUID=${PUID} and PGID=${PGID}."
    fi
  else
    useradd --no-create-home --uid "$PUID" --gid "$PGID" --home-dir /app \
      --shell /usr/sbin/nologin "$APP_USER" \
      || fail "Unable to create ${APP_USER} user with PUID=${PUID} and PGID=${PGID}."
  fi
}

check_storage_path() {
  path="$1"
  if [ "$(id -u)" = "0" ]; then
    run_as_user="gosu $APP_USER"
  else
    run_as_user=""
  fi
  $run_as_user sh -c '
    path="$1"
    test -d "$path" || exit 10
    test -w "$path" || exit 11
    test -x "$path" || exit 12
    probe="$path/.owi-write-test-$$"
    : > "$probe" || exit 13
    rm -f "$probe" || exit 14
  ' sh "$path" || fail "Storage path is not writable by ${APP_USER} (${PUID}:${PGID}): ${path}"
}

prepare_storage_path() {
  path="$1"
  mkdir -p "$path" || fail "Unable to create storage path: ${path}"
  if [ "$(id -u)" = "0" ]; then
    chown -R "$APP_USER:$APP_GROUP" "$path" \
      || fail "Unable to set ownership on storage path: ${path}"
    chmod -R u+rwX,g+rwX,o-rwx "$path" \
      || fail "Unable to set private read/write permissions on storage path: ${path}"
  fi
  check_storage_path "$path"
}

prepare_storage() {
  prepare_storage_path "$(resolve_storage_path "${RECEIPT_STORAGE_PATH:-data/receipts}")"
  prepare_storage_path "$(resolve_storage_path "${ASSET_STORAGE_PATH:-data/assets}")"
  prepare_storage_path "$(resolve_storage_path "${VAULT_STORAGE_PATH:-data/vault}")"
  prepare_storage_path "$(resolve_storage_path "${OCR_STORAGE_PATH:-data/ocr}")"
  prepare_storage_path "$(resolve_storage_path "${BACKUP_STORAGE_PATH:-data/backups}")"
}

if [ "$(id -u)" = "0" ]; then
  ensure_identity
  prepare_storage
  gosu "$APP_USER" alembic upgrade head
  exec gosu "$APP_USER" "$@"
fi

prepare_storage
alembic upgrade head
exec "$@"
