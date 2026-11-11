#!/usr/bin/env bash
# A worktree for a parallel agent in a cloud session: .worktrees/<name> with its own database mordheim_<name>, its
# own backend/.env, packages and migrations, so its gates and QA app never share the main checkout's.
#
# Usage: bash scripts/cloud/worktree.sh add <name> [<branch> [<base>]]   (branch defaults to <name>, base to HEAD)
#        bash scripts/cloud/worktree.sh remove <name>                    (drops its database; refuses a dirty tree)
# Then run that worktree's own scripts: bash .worktrees/<name>/scripts/cloud/gate-backend.sh, and its dev.sh on
# other ports (BACKEND_PORT=8001 FRONTEND_PORT=5174).
set -eu
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cmd="${1:-}"
name="${2:-}"
[ -n "$cmd" ] && [ -n "$name" ] || { sed -n '5,6p' "$0"; exit 2; }
wt="$ROOT/.worktrees/$name"
db="mordheim_$(echo "$name" | tr -c 'a-zA-Z0-9\n' '_')"

case "$cmd" in
  add)
    branch="${3:-$name}"
    base="${4:-HEAD}"
    if git -C "$ROOT" show-ref --verify --quiet "refs/heads/$branch"; then
      git -C "$ROOT" worktree add "$wt" "$branch"
    else
      git -C "$ROOT" worktree add "$wt" -b "$branch" "$base"
    fi
    CLAUDE_CODE_REMOTE=true MORDHEIM_DB="$db" bash "$wt/scripts/cloud/session-start.sh"
    echo "worktree $wt on $branch, database $db"
    ;;
  remove)
    git -C "$ROOT" worktree remove "$wt"
    pg_start >/dev/null && as_postgres dropdb --if-exists --force "$db"
    echo "removed $wt and database $db (the branch stays)"
    ;;
  *)
    sed -n '5,6p' "$0"
    exit 2
    ;;
esac
