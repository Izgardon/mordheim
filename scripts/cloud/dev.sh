#!/usr/bin/env bash
# The app for QA in a cloud session, in the background: Django's runserver on 127.0.0.1:$BACKEND_PORT (8000) and
# Vite on $FRONTEND_PORT (5173), proxying /api to that backend. Open http://localhost:5173 in the session's Chrome.
# Realtime is off (no Pusher key); the database must be seeded first (CLAUDE.md, "Cloud sessions").
#
# Usage: bash scripts/cloud/dev.sh start | stop | status | logs
# A worktree's own copy serves that worktree; give each its own ports (BACKEND_PORT=8001 FRONTEND_PORT=5174 ...).
set -u
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
BP="${BACKEND_PORT:-8000}"
FP="${FRONTEND_PORT:-5173}"
RUN="${TMPDIR:-/tmp}/mordheim-dev-$FP"
mkdir -p "$RUN"

up() { curl -fsS -o /dev/null --max-time 2 "$1" 2>/dev/null; }

wait_for() {
  for _ in $(seq 1 90); do
    up "$1" && return 0
    sleep 1
  done
  return 1
}

stop() {
  pkill -f "manage.py runserver 127.0.0.1:$BP" 2>/dev/null || true
  pkill -f "vite --host 0.0.0.0 --port $FP" 2>/dev/null || true
}

case "${1:-start}" in
  start)
    pg_start || { echo "Postgres didn't start"; exit 1; }
    # `exec` and the redirections outside the subshell matter: `( cmd >log & )` leaves a bash that waits on the
    # server while still holding this script's stdout, so `dev.sh start | ...` never finishes. This leaves only the
    # server itself, its output in the log and nothing on the caller's pipe.
    if ! up "http://127.0.0.1:$BP/api/health/"; then
      (cd "$ROOT/backend" && exec nohup $UVR python manage.py runserver "127.0.0.1:$BP") \
        >"$RUN/backend.log" 2>&1 </dev/null &
    fi
    if ! up "http://127.0.0.1:$FP/"; then
      (cd "$ROOT/frontend" && API_PROXY_TARGET="http://127.0.0.1:$BP" \
        exec nohup npx vite --host 0.0.0.0 --port "$FP") >"$RUN/frontend.log" 2>&1 </dev/null &
    fi
    wait_for "http://127.0.0.1:$BP/api/health/" || { echo "backend didn't start:"; tail -20 "$RUN/backend.log"; exit 1; }
    wait_for "http://127.0.0.1:$FP/api/health/" || { echo "frontend didn't start:"; tail -20 "$RUN/frontend.log"; exit 1; }
    echo "running: http://localhost:$FP (API on 127.0.0.1:$BP); logs in $RUN"
    ;;
  stop)
    stop
    echo "stopped"
    ;;
  status)
    up "http://127.0.0.1:$BP/api/health/" && echo "backend: up on $BP" || echo "backend: down"
    up "http://127.0.0.1:$FP/api/health/" && echo "frontend: up on $FP, proxying the API" || echo "frontend: down"
    ;;
  logs)
    tail -40 "$RUN/backend.log" 2>/dev/null
    tail -20 "$RUN/frontend.log" 2>/dev/null
    ;;
  *)
    echo "usage: $0 start | stop | status | logs"
    exit 2
    ;;
esac
