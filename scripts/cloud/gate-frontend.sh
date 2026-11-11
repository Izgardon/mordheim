#!/usr/bin/env bash
# The frontend gate, run natively in a cloud session: typecheck, lint, format:check, build and vitest. Prints each
# step's result (a failure's tail) and exits non-zero if any step fails.
set -u
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$ROOT/frontend" || exit 1
LOGS="${TMPDIR:-/tmp}/mordheim-gate-$(basename "$ROOT")"
mkdir -p "$LOGS"
[ -d node_modules ] || frontend_deps

status=0
run() {
  local name=$1 log="$LOGS/fe-$1.log"
  shift
  if "$@" >"$log" 2>&1; then
    echo "== $name: ok"
  else
    echo "== $name: FAILED ($log)"
    tail -40 "$log"
    status=1
  fi
}

run typecheck npm run typecheck
run lint npm run lint
grep -E "problems" "$LOGS/fe-lint.log" || true
run format npm run format:check
run build npm run build
run vitest npm run test:run
grep -E "Test Files|Tests  " "$LOGS/fe-vitest.log" || true
echo "== gate status: $status"
exit $status
