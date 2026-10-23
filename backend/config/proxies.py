"""How many proxies stand in front of the app, so the throttles find the client's address (SEC-04).

DRF takes the client from X-Forwarded-For, NUM_PROXIES entries from the right. Without NUM_PROXIES it takes the whole
header, which a client can set to anything, so every request could get a fresh throttle bucket. Render puts one proxy
in front of the service, so with DEBUG off an unset RATE_LIMIT_NUM_PROXIES means 1 (William, 2026-10-21) and gunicorn
logs one warning as it starts. An explicit value always wins, 0 included; one that isn't a whole number of 0 or more
stops startup. Local dev (DEBUG on) keeps DRF's default when it's unset.
"""

from collections.abc import Mapping

from django.core.exceptions import ImproperlyConfigured

VARIABLE = "RATE_LIMIT_NUM_PROXIES"
ASSUMED = 1
ASSUMED_WARNING = "RATE_LIMIT_NUM_PROXIES is not set; assuming 1 proxy (Render). Set it if the deployment changes."
_TRUE = frozenset({"1", "true", "yes", "on"})  # as settings reads DJANGO_DEBUG


def _raw(environ: Mapping[str, str]) -> str:
    return (environ.get(VARIABLE) or "").strip()


def num_proxies(environ: Mapping[str, str], debug: bool) -> int | None:
    """NUM_PROXIES for these settings: the variable's value, else 1 in production and DRF's default (None) locally."""
    raw = _raw(environ)
    if not raw:
        return None if debug else ASSUMED
    try:
        value = int(raw)
    except ValueError:
        value = -1
    if value < 0:
        raise ImproperlyConfigured(f"{VARIABLE} must be a whole number of proxies, 0 or more (got {raw!r}).")
    return value


def is_assumed(environ: Mapping[str, str]) -> bool:
    """Whether the settings will assume the count (DEBUG off, the variable unset). Read straight from the environment
    for gunicorn's master process, which never loads the settings (nor `backend/.env`, which Render doesn't have)."""
    debug = (environ.get("DJANGO_DEBUG") or "").strip().lower() in _TRUE
    return not debug and not _raw(environ)
