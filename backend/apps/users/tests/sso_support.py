"""Shared fixtures for the social sign-in tests.

Both providers are mocked entirely: `apps.users.sso.client` is the only module that touches the network, so the
tests replace `exchange_code` and `fetch_profile` there. The test runner refuses any non-loopback connection
(`config.test_runner`), so a missing mock fails loudly rather than reaching Google or Discord.
"""

from typing import Any
from unittest.mock import patch

from django.test import override_settings

from apps.users.sso.base import SsoProfile

from .auth_support import AuthTestCase

PROVIDERS = "/api/auth/sso/providers/"


def start_url(provider: str = "google") -> str:
    return f"/api/auth/sso/{provider}/start/"


def callback_url(provider: str = "google") -> str:
    return f"/api/auth/sso/{provider}/callback/"


def profile(
    subject: str = "google-subject-1",
    email: str = "pia@example.com",
    email_verified: bool = True,
    name: str = "Pia",
) -> SsoProfile:
    return SsoProfile(subject=subject, email=email, email_verified=email_verified, name=name)


# Both providers set up, so the endpoints are live and nothing reads a real credential.
sso_configured = override_settings(
    GOOGLE_OAUTH_CLIENT_ID="google-client-id",
    GOOGLE_OAUTH_CLIENT_SECRET="google-client-secret",
    DISCORD_OAUTH_CLIENT_ID="discord-client-id",
    DISCORD_OAUTH_CLIENT_SECRET="discord-client-secret",
    FRONTEND_URL="http://localhost:5173",
)


@sso_configured
class SsoTestCase(AuthTestCase):
    """Both providers configured, with the provider HTTP calls mocked for the whole test."""

    def setUp(self) -> None:
        super().setUp()
        self.exchange = self.patch("exchange_code", return_value="provider-access-token")
        self.fetch = self.patch("fetch_profile", return_value=profile())

    def patch(self, name: str, **kwargs: Any) -> Any:
        patcher = patch(f"apps.users.services.sso.{name}", **kwargs)
        self.addCleanup(patcher.stop)
        return patcher.start()

    def begin(self, provider: str = "google") -> dict[str, str]:
        """A started attempt's `{authorize_url, state, browser_token}`."""
        response = self.client.get(start_url(provider))
        assert response.status_code == 200, response.data
        started: dict[str, str] = response.json()
        return started

    def callback(self, provider: str = "google", code: str = "provider-code", **fields: str) -> Any:
        """Post a callback, filling `state` and `browser_token` from a fresh attempt unless given."""
        if "state" not in fields or "browser_token" not in fields:
            attempt = self.begin(provider)
            fields = {"state": attempt["state"], "browser_token": attempt["browser_token"], **fields}
        return self.post(callback_url(provider), {"code": code, **fields})

    def sign_in_with(self, given: Any, provider: str = "google", **fields: str) -> Any:
        """A callback whose provider asserts `given`."""
        self.fetch.return_value = given
        return self.callback(provider, **fields)
