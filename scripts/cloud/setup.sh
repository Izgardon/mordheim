#!/usr/bin/env bash
# The cloud environment's setup script runs this (CLAUDE.md, "Cloud sessions"): as root, before Claude starts, and
# the disk it leaves is cached for later sessions (about 7 days, or until the script or allowed hosts change). It
# installs the PDF tools, the backend's Python packages and the frontend's node modules, and migrates an empty local
# database, so a session starts with nothing to download. Safe to run again; reaches only the default allowlist
# (Ubuntu's archive, PyPI, npm, and GitHub if uv has to fetch Python 3.12).
set -e
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
export DEBIAN_FRONTEND=noninteractive
started=$(date +%s)
log() { echo "[setup $(($(date +%s) - started))s] $*"; }

# The PDF tools (pdftotext, pdfinfo, pdftoppm, pdfimages, tesseract), beside the rest. Only the PDF warband work
# needs them, so a failure here doesn't fail the setup.
apt_log=$(mktemp)
(apt-get update -qq && apt-get install -y -qq --no-install-recommends poppler-utils tesseract-ocr) >"$apt_log" 2>&1 &
apt_pid=$!

command -v uv >/dev/null || python3 -m pip install --quiet --break-system-packages uv || true

# A registry hiccup gets one more try; a second failure fails the setup, so no snapshot is cached without them
retry() { "$@" || { log "retrying: $*"; sleep 5; "$@"; }; }

log "backend packages (uv sync)"
retry backend_deps
log "frontend packages (npm ci)"
retry frontend_deps

# An empty database migrated in the snapshot leaves each session only the migrations newer than it
if pg_start; then
  write_backend_env mordheim
  if pg_ensure_db mordheim && migrate >/dev/null; then
    log "database mordheim migrated"
  else
    log "migrating failed; the session-start hook tries again"
  fi
  $SUDO service postgresql stop >/dev/null 2>&1 || true
else
  log "Postgres didn't start; the session-start hook tries again"
fi

if wait "$apt_pid"; then
  log "PDF tools installed ($(pdftotext -v 2>&1 | head -1), $(tesseract --version 2>&1 | head -1))"
else
  log "PDF tools failed to install (not needed outside the PDF warband work):"
  tail -5 "$apt_log" || true
fi
rm -f "$apt_log"
log "done"
