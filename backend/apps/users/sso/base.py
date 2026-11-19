"""The shapes every SSO provider is described in, and the one refusal the flow raises.

A `Provider` is data: the three endpoints, the scope, the names of the settings holding its credentials, and the one
function that reads its profile answer. A `SsoProfile` is what we take from a provider: the subject id (the only
stable key), the asserted email and *whether the provider says it is verified*, and a display name.

`SsoError` carries the HTTP status and the code the API answers with. **Never 401**: the frontend signs out on a 401
after a refresh, so a cancelled or forged sign-in attempt must not look like an ended session (see CLAUDE.md,
"Sessions"). Every status here is a 400, 403 or 503.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from typing import Any

# Codes the API answers with, so the frontend can word each case itself.
UNKNOWN_PROVIDER = "sso_unknown_provider"  # 400: not a provider we have
NOT_CONFIGURED = "sso_not_configured"  # 503: no client id or secret on this deploy
INVALID_STATE = "sso_invalid_state"  # 400: unknown, expired, already used, or another browser's state
EXCHANGE_FAILED = "sso_exchange_failed"  # 400: the provider refused the code
PROVIDER_UNAVAILABLE = "sso_provider_unavailable"  # 503: the provider couldn't be reached
NO_SUBJECT = "sso_no_subject"  # 400: the provider's profile carried no stable id
ACCOUNT_UNAVAILABLE = "sso_account_unavailable"  # 403: the linked account is a deleted (inactive) one


@dataclass(frozen=True)
class SsoProfile:
    """What a provider asserts about the person signing in.

    `email_verified` is only ever true when the provider itself says the address is verified; an address we can't
    trust is kept (for the identity row) with `email_verified` false, and never matched against an account.
    """

    subject: str
    email: str
    email_verified: bool
    name: str


@dataclass(frozen=True)
class Provider:
    slug: str
    label: str
    authorize_url: str
    token_url: str
    profile_url: str
    scope: str
    client_id_setting: str
    client_secret_setting: str
    read_profile: Callable[[Mapping[str, Any]], SsoProfile]
    # Extra authorize-URL parameters this provider wants (Google's `access_type`, say).
    authorize_extras: Mapping[str, str] = field(default_factory=dict)


class SsoError(Exception):
    """A refused sign-in attempt: `code` and `status` go straight into the API's error body."""

    def __init__(self, code: str, status: int, detail: str) -> None:
        super().__init__(detail)
        self.code = code
        self.status = status
        self.detail = detail

    def body(self) -> dict[str, Any]:
        return {"detail": self.detail, "code": self.code, "fields": {}}


def as_bool(value: Any) -> bool:
    """A provider's JSON flag as a bool: true only for `True` or the string "true" (Google has sent both)."""
    if isinstance(value, bool):
        return value
    return isinstance(value, str) and value.strip().lower() == "true"


def clean_email(value: Any) -> str:
    return str(value or "").strip().lower()
