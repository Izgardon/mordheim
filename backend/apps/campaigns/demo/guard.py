"""Where the demo seed may run: its users' password is "password", so only with DEBUG on and against a local docker
database (a host of `db`, `localhost` or `127.0.0.1`, or one the caller vouches for with `--force-local`)."""

from django.conf import settings
from django.core.management.base import CommandError
from django.db import connection

LOCAL_HOSTS = frozenset({"db", "localhost", "127.0.0.1"})


def database_host() -> str:
    return str(connection.settings_dict.get("HOST") or "")


def check_local(*, force_local: bool = False) -> None:
    """CommandError unless DEBUG is on and the database is local (or `force_local` says it is)."""
    if not settings.DEBUG:
        raise CommandError(
            "seed_demo_campaign only runs with DEBUG on (DJANGO_DEBUG=1): every demo user's password is 'password'."
        )
    host = database_host()
    if host not in LOCAL_HOSTS and not force_local:
        raise CommandError(
            f"seed_demo_campaign only runs against a local database (host db, localhost or 127.0.0.1), not "
            f"{host or 'a socket'!r}. Pass --force-local if this database really is local."
        )
