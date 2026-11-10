# Shared helpers for scripts/cloud/*.sh (sourced, never run). Linux only: a cloud session's Ubuntu VM.
#
# ROOT is the checkout that holds this file, so a worktree's own copy of these scripts serves that worktree.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# backend/Dockerfile and CI use 3.12, the VM's own python3 (Ubuntu 24.04); Django 5.0 goes no higher
PY_VERSION=3.12
# `uv run` with the dev tools (ruff, mypy, coverage) and the lock as it is
UVR="uv run --frozen --all-extras --python $PY_VERSION"

if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo -n"; fi

as_postgres() {
  if [ "$(id -u)" -eq 0 ]; then
    (cd / && runuser -u postgres -- "$@")
  else
    (cd / && sudo -n -u postgres "$@")
  fi
}

# Starts the VM's Postgres 16 if it isn't up; true once it answers on localhost:5432
pg_start() {
  if ! pg_isready -q -h localhost -p 5432 2>/dev/null; then
    $SUDO service postgresql start >/dev/null 2>&1 || true
    for _ in $(seq 1 40); do
      pg_isready -q -h localhost -p 5432 2>/dev/null && break
      sleep 0.5
    done
  fi
  pg_isready -q -h localhost -p 5432 2>/dev/null
}

# The role the backend signs in as (postgres/postgres, throwaway) and database $1, made if missing
pg_ensure_db() {
  as_postgres psql -qtAc "ALTER ROLE postgres WITH PASSWORD 'postgres'" >/dev/null || return 1
  if [ "$(as_postgres psql -qtAc "SELECT 1 FROM pg_database WHERE datname = '$1'")" != "1" ]; then
    as_postgres createdb "$1" || return 1
  fi
}

pg_recreate_db() {
  as_postgres dropdb --if-exists --force "$1" && as_postgres createdb "$1"
}

# backend/.env for database $1 with throwaway local values, unless one exists already. Its Resend and Pusher keys
# are empty, so nothing sends email or publishes realtime events (the frontend turns realtime off without a key).
write_backend_env() {
  local env="$ROOT/backend/.env"
  [ -f "$env" ] && return 0
  cat >"$env" <<EOF
# Written by scripts/cloud for this cloud VM's own Postgres: throwaway local values, no real keys.
DJANGO_DEBUG=1
DJANGO_SECRET_KEY=dev-secret-key
POSTGRES_DB=$1
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
CORS_ALLOWED_ORIGINS=http://localhost:5173
FRONTEND_URL=http://localhost:5173
RESEND_API_KEY=
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=
EOF
}

# backend/.venv from uv.lock (uv's cache in ~/.cache/uv makes a repeat quick)
backend_deps() {
  (cd "$ROOT/backend" && uv sync --frozen --all-extras --python "$PY_VERSION" --quiet)
}

# frontend/node_modules from package-lock.json, skipped while package.json and the lock are unchanged
frontend_deps() {
  local marker="$ROOT/frontend/node_modules/.cloud-install.sha256" want
  want=$(cat "$ROOT/frontend/package.json" "$ROOT/frontend/package-lock.json" | sha256sum | cut -d' ' -f1)
  if [ -f "$marker" ] && [ "$(cat "$marker")" = "$want" ]; then
    return 0
  fi
  (cd "$ROOT/frontend" && npm ci --prefer-offline --no-audit --no-fund --update-notifier=false --loglevel=error) && echo "$want" >"$marker"
}

migrate() {
  (cd "$ROOT/backend" && $UVR python manage.py migrate --noinput)
}
