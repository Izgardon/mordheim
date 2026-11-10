#!/usr/bin/env bash
# The backend gate, run natively in a cloud session: tests, ruff check, ruff format --check, mypy and the migration
# check. Prints each step's last lines (the first 40 of a failure's tail) and exits non-zero if any step fails.
#
# The tests run in one process, as CI and the local gates run them. GATE_PARALLEL=auto runs one per CPU, about
# three times faster, but without tblib a failing test stops the whole run (Django can't send its traceback back),
# so use it to confirm a green tree, not to find failures. Needs the local Postgres the session-start hook starts;
# the tests make and drop test_<database> themselves.
set -u
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$ROOT/backend" || exit 1
export DJANGO_SETTINGS_MODULE=config.settings
LOGS="${TMPDIR:-/tmp}/mordheim-gate-$(basename "$ROOT")"
mkdir -p "$LOGS"
pg_start >/dev/null || echo "== Postgres isn't answering on localhost:5432; the tests will fail"

status=0
run() {
  local name=$1 log="$LOGS/be-${1// /-}.log"
  shift
  if "$@" >"$log" 2>&1; then
    echo "== $name: ok"
    tail -3 "$log"
  else
    echo "== $name: FAILED ($log)"
    tail -40 "$log"
    status=1
  fi
}

run tests $UVR python manage.py test --noinput --parallel "${GATE_PARALLEL:-1}"
run "ruff check" $UVR ruff check --no-cache .
run "ruff format" $UVR ruff format --no-cache --check .
run mypy $UVR mypy . --config-file pyproject.toml --cache-dir "${XDG_CACHE_HOME:-$HOME/.cache}/mordheim-mypy-$(basename "$ROOT")"
run migrations $UVR python manage.py makemigrations --check --dry-run
echo "== gate status: $status"
exit $status
