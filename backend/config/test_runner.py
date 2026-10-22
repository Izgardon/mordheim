"""Test runner that keeps the suite off the network.

Settings load ``backend/.env``, which holds real Resend and Pusher credentials, so a
plain ``manage.py test`` would send real email and publish events to the production
Pusher app. This runner blanks those settings for the whole run and refuses any
outbound socket connection that isn't loopback, so a missing mock fails loudly
instead of reaching a real service.
"""

import logging
import socket
from contextlib import ExitStack
from typing import Any
from unittest.mock import patch

from django.test.runner import DiscoverRunner
from django.test.utils import override_settings

from apps.realtime.services import get_pusher_client

EXTERNAL_SERVICE_SETTINGS = {
    "RESEND_API_KEY": "",
    "PUSHER_APP_ID": "",
    "PUSHER_KEY": "",
    "PUSHER_SECRET": "",
    "PUSHER_CLUSTER": "",
}

# DRF's test client logs out through a session (`force_authenticate(user=None)` calls `logout()`), and the sessions
# app isn't installed (INFRA-CQ-03), so the run uses the signed-cookie engine, which needs no table
TEST_SESSION_ENGINE = "django.contrib.sessions.backends.signed_cookies"

_LOOPBACK_HOSTS = {"127.0.0.1", "::1", "localhost"}


class ExternalNetworkCallError(RuntimeError):
    """Raised when a test tries to open a connection to a non-loopback host."""


def _refuse_if_external(sock: socket.socket, address: Any) -> None:
    if sock.family in (socket.AF_INET, socket.AF_INET6) and address[0] not in _LOOPBACK_HOSTS:
        raise ExternalNetworkCallError(f"Test tried to connect to {address!r}. Mock the external service instead.")


class NoNetworkTestRunner(DiscoverRunner):
    def setup_test_environment(self, **kwargs: Any) -> None:
        super().setup_test_environment(**kwargs)
        self._external_settings = override_settings(
            **EXTERNAL_SERVICE_SETTINGS, EXTERNAL_DISPATCH_SYNC=True, SESSION_ENGINE=TEST_SESSION_ENGINE
        )
        self._external_settings.enable()
        get_pusher_client.cache_clear()
        self._install_socket_guard()
        # LOGGING prints django.request's 4xx and 5xx answers; here they would only repeat what the tests assert (the
        # test client raises a view's exception itself), so they stay out of the output
        self._request_logger = logging.getLogger("django.request")
        self._request_log_level = self._request_logger.level
        self._request_logger.setLevel(logging.CRITICAL)

    def teardown_test_environment(self, **kwargs: Any) -> None:
        self._request_logger.setLevel(self._request_log_level)
        self._remove_socket_guard()
        self._external_settings.disable()
        get_pusher_client.cache_clear()
        super().teardown_test_environment(**kwargs)

    def _install_socket_guard(self) -> None:
        real_connect = socket.socket.connect
        real_connect_ex = socket.socket.connect_ex

        def guarded_connect(sock: socket.socket, address: Any) -> None:
            _refuse_if_external(sock, address)
            real_connect(sock, address)

        def guarded_connect_ex(sock: socket.socket, address: Any) -> int:
            _refuse_if_external(sock, address)
            return real_connect_ex(sock, address)

        self._socket_guard = ExitStack()
        self._socket_guard.enter_context(patch.object(socket.socket, "connect", guarded_connect))
        self._socket_guard.enter_context(patch.object(socket.socket, "connect_ex", guarded_connect_ex))

    def _remove_socket_guard(self) -> None:
        self._socket_guard.close()
