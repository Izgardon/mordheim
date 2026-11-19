"""The shared social sign-in flow: OAuth 2.0 Authorization Code with PKCE, every secret server-side.

`start` builds the provider's authorize URL and keeps the PKCE verifier here, with a `state` bound to the browser
that asked and good for ten minutes. The provider sends the person back to the frontend, which posts the `code`,
the `state` and its browser secret to `complete`.

`complete` consumes the attempt first, in its own transaction, so a replayed `code` finds nothing; only then does it
talk to the provider (a lock is never held across an HTTP call), and only then does it link or make an account. The
tokens come from `accounts.sign_in`, the same path a password sign-in uses, so the session key and "sign out other
sessions" work exactly as they do for a password account.

The redirect URI is derived from `FRONTEND_URL`, so there is one setting to get right and it is the one the
password-reset links already use. It must match what is registered with the provider, character for character.
"""

from __future__ import annotations

import base64
import hashlib
import secrets
from datetime import timedelta
from typing import Any
from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from ..models import SsoLoginAttempt
from ..sso.base import INVALID_STATE, NO_SUBJECT, Provider, SsoError
from ..sso.client import exchange_code, fetch_profile
from ..sso.registry import credentials, provider_for
from .accounts import sign_in
from .sso_accounts import SignIn, link_or_create

# A person has ten minutes between pressing the button and coming back from the provider.
ATTEMPT_TTL = timedelta(minutes=10)
CALLBACK_PATH = "/auth/callback/"
STATE_INVALID = "That sign-in attempt has expired or was already used. Please try again."
NO_SUBJECT_DETAIL = "That provider didn't identify the account. Please try again."


def callback_uri(provider: Provider) -> str:
    """Where the provider sends the person back: the frontend's callback route for this provider. Registered with
    the provider as-is, so tokens never ride in a URL (the frontend posts the code to us)."""
    return f"{settings.FRONTEND_URL.rstrip('/')}{CALLBACK_PATH}{provider.slug}"


def _challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).decode().rstrip("=")


def _hashed(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def start(slug: str) -> dict[str, str]:
    """`{authorize_url, state, browser_token}` for a new attempt. The browser keeps `browser_token` and sends it
    back with the code; only its hash is stored, so the row alone can't complete a sign-in."""
    provider = provider_for(slug)
    client_id, _ = credentials(provider)
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)  # 86 characters, inside PKCE's 43-128
    browser_token = secrets.token_urlsafe(32)
    redirect_uri = callback_uri(provider)

    SsoLoginAttempt.objects.create(
        provider=provider.slug,
        state=state,
        code_verifier=verifier,
        browser_hash=_hashed(browser_token),
        redirect_uri=redirect_uri,
    )
    query = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": provider.scope,
        "state": state,
        "code_challenge": _challenge(verifier),
        "code_challenge_method": "S256",
        **provider.authorize_extras,
    }
    return {
        "authorize_url": f"{provider.authorize_url}?{urlencode(query)}",
        "state": state,
        "browser_token": browser_token,
    }


def _consume(provider: Provider, state: str, browser_token: str) -> SsoLoginAttempt:
    """The attempt this `state` names, marked used, or SsoError 400 `sso_invalid_state`.

    One short transaction, with the row locked, so two requests racing the same state can't both redeem it: a
    replay, a forged or unknown state, one for another provider, one over ten minutes old and one from another
    browser are all the same refusal, saying nothing about which it was.
    """
    cutoff = timezone.now() - ATTEMPT_TTL
    with transaction.atomic():
        attempt = SsoLoginAttempt.objects.select_for_update().filter(state=state).first()
        if (
            attempt is None
            or attempt.provider != provider.slug
            or attempt.consumed_at is not None
            or attempt.created_at < cutoff
            or not secrets.compare_digest(attempt.browser_hash, _hashed(browser_token))
        ):
            raise SsoError(INVALID_STATE, 400, STATE_INVALID)
        attempt.consumed_at = timezone.now()
        attempt.save(update_fields=["consumed_at"])
    return attempt


def complete(slug: str, code: str, state: str, browser_token: str) -> tuple[Any, dict[str, str], SignIn]:
    """Finish a sign-in: `(user, tokens, outcome)`, the tokens minted by the password path's `sign_in`.

    Raises SsoError for every failure (400, 403 or 503 — never 401).
    """
    provider = provider_for(slug)
    attempt = _consume(provider, state, browser_token)
    access_token = exchange_code(provider, code, attempt.redirect_uri, attempt.code_verifier)
    profile = fetch_profile(provider, access_token)
    if not profile.subject:
        raise SsoError(NO_SUBJECT, 400, NO_SUBJECT_DETAIL)
    outcome = link_or_create(provider.slug, profile)
    return outcome.user, sign_in(outcome.user), outcome


def drop_stale_attempts() -> int:
    """Attempts past their ten minutes, used or not, deleted. Called after each start, so the table stays small
    without a cron job."""
    deleted, _ = SsoLoginAttempt.objects.filter(created_at__lt=timezone.now() - ATTEMPT_TTL).delete()
    return deleted
