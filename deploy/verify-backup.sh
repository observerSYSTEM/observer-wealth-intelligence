#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: deploy/verify-backup.sh /path/to/observer-backup.tar.gz" >&2
  exit 2
fi

ARCHIVE="$1"
WORKDIR="$(mktemp -d)"
cleanup() {
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

tar -tzf "$ARCHIVE" >/dev/null
tar -xzf "$ARCHIVE" -C "$WORKDIR"

ROOT="$(find "$WORKDIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
if [ -z "$ROOT" ]; then
  echo "Backup archive did not contain a root directory" >&2
  exit 1
fi

if [ -f "$ROOT/SHA256SUMS" ]; then
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$ROOT" && sha256sum -c SHA256SUMS)
  elif command -v shasum >/dev/null 2>&1; then
    (cd "$ROOT" && shasum -a 256 -c SHA256SUMS)
  else
    echo "No SHA256 tool available; tar structure verification passed only" >&2
  fi
fi

if [ ! -f "$ROOT/observer-wealth.dump" ]; then
  echo "PostgreSQL dump is missing" >&2
  exit 1
fi

echo "Backup verification passed: $ARCHIVE"
