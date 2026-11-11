#!/usr/bin/env bash
# The SessionStart hook in .claude/settings.json runs this. In a cloud session (CLAUDE_CODE_REMOTE=true) it gets the
# app ready: Postgres started, the role and database made if missing, a throwaway backend/.env if there is none,
# the Python and node packages installed if the checkout lacks them, and the migrations run. Anywhere else, such as
# William's PC, it does nothing. It never fails the session, and its short summary is what Claude reads.
#
# MORDHEIM_DB names the database (default mordheim); scripts/cloud/worktree.sh gives each worktree its own.
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
DB="${MORDHEIM_DB:-mordheim}"
LOG="${TMPDIR:-/tmp}/mordheim-session-start-$(basename "$ROOT").log"
problems=()

{
  echo "== $(date -u +%FT%TZ) $ROOT"
  if pg_start; then
    pg_ensure_db "$DB" || problems+=("couldn't make the role or database $DB")
  else
    problems+=("Postgres didn't start (service postgresql start)")
  fi
  write_backend_env "$DB" || problems+=("couldn't write backend/.env")
  backend_deps || problems+=("uv sync failed in backend/")
  frontend_deps || problems+=("npm ci failed in frontend/")
  if [ ${#problems[@]} -eq 0 ]; then
    # Local data is disposable: a database the migrations no longer fit (a branch that rewrote them) starts afresh
    if ! migrate; then
      echo "migrate failed: recreating $DB"
      pg_recreate_db "$DB" && migrate || problems+=("migrate failed even on an empty $DB")
    fi
  fi
} >>"$LOG" 2>&1

if [ ${#problems[@]} -gt 0 ]; then
  echo "Cloud session setup is incomplete: $(IFS=';'; echo "${problems[*]}"). Log: $LOG"
  exit 0
fi

seeded=$(as_postgres psql -d "$DB" -qtAc "SELECT EXISTS (SELECT 1 FROM hired_sword)" 2>/dev/null)
if [ "$seeded" = "t" ]; then
  seed_line="The catalogue is seeded."
else
  seed_line="Nothing is seeded: run 'cd backend && uv run python manage.py seed_all' (and seed_demo_campaign) before QA."
fi
echo "Cloud session ready: Postgres up, database $DB migrated, backend/.env local and throwaway. $seed_line" \
  "Gates: bash scripts/cloud/gate-backend.sh and gate-frontend.sh; the app: bash scripts/cloud/dev.sh start" \
  "(CLAUDE.md, \"Cloud sessions\")."
exit 0
