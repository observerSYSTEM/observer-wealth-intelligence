#!/usr/bin/env bash
set -uo pipefail

FAILURES=0
WARNINGS=0

pass() {
  printf 'PASS    %s\n' "$1"
}

warn() {
  WARNINGS=$((WARNINGS + 1))
  printf 'WARNING %s\n' "$1"
}

fail() {
  FAILURES=$((FAILURES + 1))
  printf 'FAIL    %s\n' "$1"
}

need_command() {
  local command_name="$1"
  local install_hint="$2"
  if command -v "$command_name" >/dev/null 2>&1; then
    pass "$command_name is available: $(command -v "$command_name")"
  else
    fail "$command_name is missing. $install_hint"
  fi
}

check_architecture() {
  local arch
  arch="$(uname -m 2>/dev/null || true)"
  case "$arch" in
    aarch64|arm64) pass "ARM64 architecture detected: $arch" ;;
    armv7l|armhf) fail "32-bit ARM detected: $arch. Install 64-bit Raspberry Pi OS." ;;
    *) fail "Unexpected architecture: ${arch:-unknown}. RC1 target is Raspberry Pi 5 ARM64." ;;
  esac
}

check_os() {
  if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    case "${ID:-}:${VERSION_CODENAME:-}" in
      raspbian:*|debian:bookworm|debian:trixie)
        pass "OS detected: ${PRETTY_NAME:-$ID}"
        ;;
      *)
        warn "OS detected: ${PRETTY_NAME:-unknown}. Validate manually against 64-bit Raspberry Pi OS."
        ;;
    esac
  else
    warn "/etc/os-release is unavailable. Validate OS manually."
  fi
}

check_ram() {
  if [ -r /proc/meminfo ]; then
    local kb mb
    kb="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
    mb=$((kb / 1024))
    if [ "$mb" -ge 3800 ]; then
      pass "RAM available: ${mb} MiB"
    else
      fail "RAM available: ${mb} MiB. Minimum target is 4 GB."
    fi
  else
    warn "Cannot read /proc/meminfo. Validate RAM manually."
  fi
}

check_disk() {
  local path="${1:-.}"
  local kb gb
  kb="$(df -Pk "$path" | awk 'NR==2 {print $4}')"
  gb=$((kb / 1024 / 1024))
  if [ "$gb" -ge 20 ]; then
    pass "Free disk space at $path: ${gb} GiB"
  elif [ "$gb" -ge 10 ]; then
    warn "Free disk space at $path: ${gb} GiB. Use external storage for receipts, vault, OCR, and backups."
  else
    fail "Free disk space at $path: ${gb} GiB. At least 10 GiB free is required for RC1 validation."
  fi
}

check_docker() {
  need_command docker "Install Docker Engine, then re-run deploy/install-pi.sh."
  if command -v docker >/dev/null 2>&1; then
    if docker version --format '{{.Server.Version}}' >/dev/null 2>&1; then
      pass "Docker Engine: $(docker version --format '{{.Server.Version}}')"
    else
      fail "Docker CLI is installed but the Docker daemon is unavailable. Start docker.service."
    fi
    if docker compose version >/dev/null 2>&1; then
      pass "Docker Compose plugin: $(docker compose version --short 2>/dev/null || docker compose version)"
    else
      fail "Docker Compose v2 plugin is unavailable. Install docker-compose-plugin."
    fi
  fi
}

check_timezone() {
  local timezone
  timezone="$(timedatectl show -p Timezone --value 2>/dev/null || true)"
  if [ "$timezone" = "Europe/London" ]; then
    pass "Timezone is Europe/London"
  elif [ -n "$timezone" ]; then
    warn "Timezone is $timezone. Run: sudo timedatectl set-timezone Europe/London"
  else
    warn "Could not read timezone with timedatectl. Validate Europe/London manually."
  fi
}

port_open() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ! ss -ltn "( sport = :$port )" | awk 'NR>1 {found=1} END {exit found ? 0 : 1}'
  elif command -v lsof >/dev/null 2>&1; then
    ! lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
  else
    return 2
  fi
}

check_ports() {
  local http_port="${HTTP_PORT:-8080}"
  for port in "$http_port"; do
    if port_open "$port"; then
      pass "Port $port is available"
    else
      local code=$?
      if [ "$code" -eq 2 ]; then
        warn "No ss/lsof available to check port $port. Install iproute2 or lsof."
      else
        fail "Port $port is already in use. Set HTTP_PORT in .env or stop the conflicting service."
      fi
    fi
  done
}

check_data_dirs() {
  for dir in data assets vault receipts ocr backups; do
    local path
    if [ "$dir" = "data" ]; then
      path="data"
    else
      path="data/$dir"
    fi
    mkdir -p "$path" 2>/dev/null || {
      fail "Cannot create $path. Fix directory ownership or mount permissions."
      continue
    }
    if [ -w "$path" ]; then
      pass "$path is writable"
    else
      fail "$path is not writable. Run: sudo chown -R 10001:$(id -g) data && sudo chmod -R u+rwX,g+rwX,o-rwx data"
    fi
  done
}

check_systemd() {
  if command -v systemctl >/dev/null 2>&1; then
    if systemctl is-system-running >/dev/null 2>&1; then
      pass "systemd is running"
    else
      warn "systemd exists but is not fully running. Check: systemctl is-system-running"
    fi
  else
    fail "systemctl is unavailable. Raspberry Pi deployment expects systemd."
  fi
}

check_pg_dump() {
  if command -v pg_dump >/dev/null 2>&1; then
    pass "Host pg_dump is available"
  else
    warn "Host pg_dump is missing. deploy/backup.sh uses pg_dump inside the PostgreSQL container."
  fi
}

check_internet() {
  local urls=(
    "https://registry-1.docker.io/v2/"
    "https://github.com/"
    "https://api.telegram.org/"
  )
  if command -v curl >/dev/null 2>&1; then
    for url in "${urls[@]}"; do
      if curl --head --silent --show-error --max-time 10 "$url" >/dev/null 2>&1; then
        pass "Internet check succeeded: $url"
      else
        warn "Internet check failed: $url. Initial image, model, or Telegram operations may fail."
      fi
    done
  else
    warn "curl is unavailable. Install curl to validate internet access."
  fi
}

check_compose_files() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    if SECRET_KEY=preflight-secret-preflight-secret-preflight \
      POSTGRES_PASSWORD=preflight-postgres-password \
      DATABASE_URL=postgresql+psycopg://observer:preflight-postgres-password@db:5432/observer_wealth \
      docker compose -f docker-compose.yml -f docker-compose.pi.yml config >/dev/null; then
      pass "Raspberry Pi Compose configuration is valid"
    else
      fail "Raspberry Pi Compose configuration failed. Run docker compose config for details."
    fi
  fi
}

main() {
  echo "Observer Wealth Intelligence Raspberry Pi preflight"
  echo "Target: Raspberry Pi 5, ARM64, 64-bit Raspberry Pi OS, Docker Compose, Europe/London"
  echo
  check_architecture
  check_os
  check_ram
  check_disk "."
  check_docker
  check_timezone
  check_ports
  check_data_dirs
  check_systemd
  check_pg_dump
  check_internet
  check_compose_files
  echo
  echo "Preflight complete: ${FAILURES} fail, ${WARNINGS} warning."
  if [ "$FAILURES" -gt 0 ]; then
    exit 1
  fi
}

main "$@"
