#!/usr/bin/env bash
#
# Close or reopen the China-edition sites by editing nginx on the Aliyun ECS.
#
# Run this ON the ECS (the CI workflow does it for you):
#     sudo bash pause-cn.sh on
#     sudo bash pause-cn.sh off
#     sudo bash pause-cn.sh status
#
# Order of operations, and why it is this order:
#   1. Tarball the whole /etc/nginx first, so there is a recovery point even if the
#      per-file backups are lost.
#   2. Let the editor patch only the server blocks it recognises, recording every
#      touched file in a manifest.
#   3. `nginx -t` before any reload. A configuration nginx rejects never goes live;
#      if the test fails, everything is rolled back and nginx is left as it was.
#   4. Reload, then verify each host from the server itself. Verification failure
#      rolls back too — a maintenance page nobody can reach is not a success.
#
# `set -e` is deliberately not used: the rollback paths need to run after a failure.

set -uo pipefail

MODE="${1:-}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/sagemro-nginx}"
MANIFEST="${MANIFEST:-$BACKUP_DIR/last-change.json}"
HOSTS=(sagemro.cn www.sagemro.cn ai.sagemro.cn admin.sagemro.cn engineer.sagemro.cn)

case "$MODE" in
  on|off|status) ;;
  *)
    echo "usage: $0 on|off|status" >&2
    exit 64
    ;;
esac

SUDO=""
if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi

edit() {
  $SUDO env PYTHON_BIN="$PYTHON_BIN" "$PYTHON_BIN" "$HERE/nginx_maintenance.py" "$@"
}

status_code() {
  curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "https://$1/" 2>/dev/null || echo 000
}

# Retries because the reload and the upstream connection are not instantaneous.
verify() {
  local expected="$1" attempt code failures=0
  for host in "${HOSTS[@]}"; do
    code=000
    for attempt in 1 2 3; do
      code="$(status_code "$host")"
      if [[ "$code" =~ $expected ]]; then break; fi
      sleep 3
    done
    if [[ "$code" =~ $expected ]]; then
      echo "verified: $host -> $code"
    else
      echo "VERIFY FAILED: $host -> $code (expected $expected)" >&2
      failures=$((failures + 1))
    fi
  done
  return "$failures"
}

$SUDO mkdir -p "$BACKUP_DIR"

if [ "$MODE" = "status" ]; then
  edit status
  exit $?
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$BACKUP_DIR/nginx-$STAMP.tgz"
if ! $SUDO tar -czf "$BACKUP" -C /etc nginx; then
  echo "error: could not back up /etc/nginx; nothing changed" >&2
  exit 1
fi
echo "backup: $BACKUP"

edit "$MODE" --manifest "$MANIFEST" --backup-dir "$BACKUP_DIR/files-$STAMP"
rc=$?
if [ "$rc" -ne 0 ]; then
  echo "error: the nginx editor failed (${rc}); nothing was reloaded" >&2
  if [ "$MODE" = "on" ]; then
    edit rollback || true
  fi
  exit "$rc"
fi

if ! $SUDO nginx -t; then
  echo "error: nginx rejected the configuration; rolling back" >&2
  edit rollback || true
  $SUDO nginx -t || true
  exit 1
fi

if ! $SUDO systemctl reload nginx; then
  echo "error: nginx reload failed; rolling back" >&2
  edit rollback || true
  $SUDO nginx -t || true
  $SUDO systemctl reload nginx || true
  exit 1
fi

if [ "$MODE" = "on" ]; then
  expected='^503$'
else
  expected='^(200|301|302)$'
fi

if ! verify "$expected"; then
  echo "error: live verification failed; rolling back" >&2
  edit rollback || true
  $SUDO nginx -t || true
  $SUDO systemctl reload nginx || true
  exit 1
fi

# Per-file backups live outside /etc/nginx (an in-tree copy would be loaded as a
# duplicate config); the tarball above and files-$STAMP are the recovery points.
if [ "$MODE" = "on" ]; then
  echo "done: China sites are paused (503). Restore with: $0 off"
else
  echo "done: China sites are live again."
fi
