"""The two HTTPS calls a sign-in makes, both server-side, both from here so tests mock one place.

The code is exchanged for an access token by this server, with the client secret, so the secret never reaches a
browser and no token the browser could have minted is trusted. Then the provider's own profile endpoint is read with
that access token.

Nothing a provider sends is logged or put in an API error: a refusal answers our own wording with a code, and the
provider's status is logged at warning level without its body, which can carry tokens.
"""

from __future__ import annotations

import logging
from typing import Any

import requests

from .base import EXCHANGE_FAILED, PROVIDER_UNAVAILABLE, Provider, SsoError, SsoProfile
from .registry import credentials

logger = logging.getLogger(__name__)

# A sign-in waits on these, so they give up quickly: (connect, read) seconds.
TIMEOUT = (5, 10)

EXCHANGE_REFUSED = "That sign-in couldn't be completed. Please try again."
UNREACHABLE = "Couldn't reach {label} just now. Please try again."


def _unavailable(provider: Provider) -> SsoError:
    return SsoError(PROVIDER_UNAVAILABLE, 503, UNREACHABLE.format(label=provider.label))


def _refused(provider: Provider, step: str, status: int) -> SsoError:
    logger.warning("SSO %s %s answered %s", provider.slug, step, status)
    return SsoError(EXCHANGE_FAILED, 400, EXCHANGE_REFUSED)


def _json(response: requests.Response) -> dict[str, Any]:
    try:
        payload = response.json()
    except ValueError:
        return {}
    return payload if isinstance(payload, dict) else {}


def exchange_code(provider: Provider, code: str, redirect_uri: str, code_verifier: str) -> str:
    """The provider's access token for `code`, or SsoError. The PKCE verifier and the client secret go in the body."""
    client_id, client_secret = credentials(provider)
    try:
        response = requests.post(
            provider.token_url,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "code_verifier": code_verifier,
                "client_id": client_id,
                "client_secret": client_secret,
            },
            headers={"Accept": "application/json"},
            timeout=TIMEOUT,
        )
    except requests.RequestException:
        raise _unavailable(provider) from None
    if response.status_code >= 400:
        raise _refused(provider, "token endpoint", response.status_code)
    token = str(_json(response).get("access_token") or "").strip()
    if not token:
        raise _refused(provider, "token endpoint", response.status_code)
    return token


def fetch_profile(provider: Provider, access_token: str) -> SsoProfile:
    """What the provider asserts about the person, read with its own access token, as `SsoProfile`."""
    try:
        response = requests.get(
            provider.profile_url,
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            timeout=TIMEOUT,
        )
    except requests.RequestException:
        raise _unavailable(provider) from None
    if response.status_code >= 400:
        raise _refused(provider, "profile endpoint", response.status_code)
    return provider.read_profile(_json(response))
