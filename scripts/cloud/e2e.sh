#!/usr/bin/env bash
# The end-to-end suite (Playwright), run natively in a cloud session. It starts Django and Vite itself (the
# `webServer` entries in e2e/playwright.config.ts) and rebuilds the e2e campaign first, so it leaves nothing behind
# and can be run again straight away. Not part of the two gates: it needs a running Postgres with the catalogue
# seeded, which `gate-backend.sh` and `gate-frontend.sh` do not.
#
# Usage: bash scripts/cloud/e2e.sh [<playwright args>]
# Give a worktree its own ports: BACKEND_PORT=8034 FRONTEND_PORT=5207 bash scripts/cloud/e2e.sh
set -u
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$ROOT/e2e" || exit 1
pg_start || { echo "Postgres didn't start"; exit 1; }
[ -d node_modules ] || npm ci --prefer-offline --no-audit --no-fund --loglevel=error || exit 1
[ -d "$ROOT/frontend/node_modules" ] || frontend_deps
exec npx playwright test --trace off "$@"
