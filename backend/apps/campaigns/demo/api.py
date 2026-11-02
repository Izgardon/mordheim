"""The demo seed's hands: the app's own API, called in process as each player, the way a click calls it.

`quiet()` is the setting the seed runs under: no rate limits (a battle is dozens of writes a minute), no Pusher and no
Resend whatever the environment holds, and `localhost` as the host the requests name.
"""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from django.conf import settings
from django.core.management.base import CommandError
from django.test.utils import override_settings
from rest_framework.test import APIClient

from apps.realtime.services import get_pusher_client

HOST = "localhost"


class SeedError(CommandError):
    """A write the API refused: the seed's plan no longer fits the app."""


@contextmanager
def quiet() -> Iterator[None]:
    hosts = [*settings.ALLOWED_HOSTS, HOST]
    blank = {"PUSHER_APP_ID": "", "PUSHER_KEY": "", "PUSHER_SECRET": "", "PUSHER_CLUSTER": "", "RESEND_API_KEY": ""}
    with override_settings(RATE_LIMIT_ENABLED=False, ALLOWED_HOSTS=hosts, **blank):
        get_pusher_client.cache_clear()  # its client was built from the real settings, if at all
        try:
            yield
        finally:
            get_pusher_client.cache_clear()


class Api:
    """`post(user, "campaigns/1/battles/", body)` and friends: the answer's data, or SeedError for any refusal."""

    def __init__(self) -> None:
        self.client = APIClient(SERVER_NAME=HOST)

    def call(self, user: Any, method: str, path: str, body: Any = None) -> Any:
        self.client.force_authenticate(user=user)
        url = f"/api/{path}"
        response = self.client.get(url) if method == "get" else getattr(self.client, method)(url, body, format="json")
        if response.status_code >= 300:
            detail = getattr(response, "data", None) or response.content[:500]
            raise SeedError(f"{method.upper()} {url} as {user.email} answered {response.status_code}: {detail}")
        return getattr(response, "data", None)

    def get(self, user: Any, path: str) -> Any:
        return self.call(user, "get", path)

    def post(self, user: Any, path: str, body: Any = None) -> Any:
        return self.call(user, "post", path, body or {})

    def patch(self, user: Any, path: str, body: Any) -> Any:
        return self.call(user, "patch", path, body)
