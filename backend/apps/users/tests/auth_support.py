"""Shared fixtures for the auth and core characterisation tests (pass 6).

The `test_auth_characterisation_*` modules lock in how register, login, refresh, me, password reset and the
feedback report behave today, before PR A fixes them and PR B moves them into services. Sessions use real JWTs
from the login endpoint (never `force_authenticate`), so the JWT user lookup is part of every request and every
query count. Known bugs are pinned with their ID and the comment "Characterises current behaviour (ID, pinned;
flips in PR A)" (or the PR or decision that changes it).

Throttles stay on at their configured rates, so each test keeps under them (or turns them off for a loop); the
default cache (LocMem) holds their counters and is cleared before each test. The test runner blanks
RESEND_API_KEY, so the email helpers skip sending unless a test sets a key, and refuses every outbound
connection, so Resend is mocked whenever a key is set.
"""

import logging
from datetime import timedelta
from typing import Any, cast

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.cache import cache
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

REGISTER = "/api/auth/register/"
LOGIN = "/api/auth/login/"
REFRESH = "/api/auth/refresh/"
ME = "/api/auth/me/"
RESET = "/api/auth/password-reset/"
RESET_CONFIRM = "/api/auth/password-reset-confirm/"
FEEDBACK = "/api/auth/feedback-report/"

PASSWORD = "lantern-of-sigmar"  # passes every configured validator
NEW_PASSWORD = "crimson-lantern-42"


def make_user(email: str, name: str = "", password: str | None = PASSWORD, **fields: Any) -> Any:
    """A user as registration makes one: the username is the (lowercased) email, the name is `first_name`."""
    return get_user_model().objects.create_user(
        username=email, email=email, password=password, first_name=name, **fields
    )


def reset_link_parts(user: Any) -> tuple[str, str]:
    """The `uid` and `token` a reset email would carry for `user` today."""
    return urlsafe_base64_encode(force_bytes(user.pk)), PasswordResetTokenGenerator().make_token(user)


def access_claims(raw: str) -> dict[str, Any]:
    """The verified payload of an encoded access token (the stubs type the argument as a Token)."""
    return dict(AccessToken(cast(Any, raw)).payload)


def refresh_claims(raw: str) -> dict[str, Any]:
    """The verified payload of an encoded refresh token."""
    return dict(RefreshToken(cast(Any, raw)).payload)


def expired_access(user: Any) -> str:
    """A correctly signed access token for `user` whose `exp` is a second ago."""
    token = AccessToken.for_user(user)
    token.set_exp(lifetime=timedelta(seconds=-1))
    return str(token)


def expired_refresh(user: Any) -> str:
    """A correctly signed refresh token for `user` past its 30 days."""
    token = RefreshToken.for_user(user)
    token.set_exp(lifetime=timedelta(seconds=-1))
    return str(token)


def quiet_request_errors(test: Any) -> None:
    """Silence django.request's traceback logging for a test that expects a 500."""
    logger = logging.getLogger("django.request")
    test.addCleanup(setattr, logger, "disabled", logger.disabled)
    logger.disabled = True


class AuthTestCase(APITestCase):
    """Pia (`pia@example.com`, name "Pia", password `PASSWORD`) exists; throttle counters start empty."""

    client: APIClient
    pia: Any

    @classmethod
    def setUpTestData(cls) -> None:
        cls.pia = make_user("pia@example.com", "Pia")

    def setUp(self) -> None:
        cache.clear()  # throttle counters

    # Requests

    def post(self, url: str, body: dict[str, Any], **extra: Any) -> Any:
        return self.client.post(url, body, format="json", **extra)

    def sign_in(self, email: str = "pia@example.com", password: str = PASSWORD) -> dict[str, str]:
        """`{access, refresh}` from a real login."""
        response = self.post(LOGIN, {"email": email, "password": password})
        assert response.status_code == 200, response.data
        return {key: response.json()[key] for key in ("access", "refresh")}

    def bearer(self, access: str) -> APIClient:
        """A fresh client that sends `Authorization: Bearer <access>`."""
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        return client

    def me(self, access: str) -> Any:
        return self.bearer(access).get(ME)

    def refresh(self, refresh: str) -> Any:
        return self.post(REFRESH, {"refresh": refresh})

    def answer_errors_with_500(self) -> None:
        """Let the test client return a 500 instead of raising, without logging the traceback."""
        self.client.raise_request_exception = False
        quiet_request_errors(self)
