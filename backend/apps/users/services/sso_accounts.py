"""Which account a social sign-in belongs to: the security-sensitive half of SSO.

Three cases, in order:

1. **The provider account is already linked** (`provider` + `subject`): that user signs in. Nothing else is
   considered, so renaming or re-pointing an email at the provider can't move the link.
2. **The provider asserts a verified email matching an active account**: the identity is linked to it, so the
   person who signed up with a password keeps one account. Matched on the username (the lowercased email, as
   registration stores it) and on the email column, so an earlier SSO account is found too.
3. **Otherwise a new account** with no usable password.

A provider that does **not** assert a verified email never matches an account (case 2 is skipped): anyone can put
somebody else's address on an unverified account, so matching it would hand over the other person's warbands. Such a
sign-in gets a new account instead of a refusal, and the untrusted address is kept on the identity row only, never
on the user, so nothing later treats it as a way to reach them.

A deleted account is an inactive user row with no email (`services.deletion`), so **nothing here can match,
resurrect or link to one**: every lookup filters `is_active=True`, and an identity pointing at an inactive user is
refused (403) rather than signed in. Deleting an account drops its identities, so the provider account is free to
start a fresh one.

The username is opaque (`sso-<random>`): it is never derived from the email, so no part of an address can leak
through it. An SSO account has no password and `username` is only a login key for the password path.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from typing import Any

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Q

from ..models import SocialIdentity, UserAccount
from ..names import NAME_MAX_LENGTH
from ..sso.base import ACCOUNT_UNAVAILABLE, SsoError, SsoProfile

# How the account was reached, for the API's answer and the tests.
BY_IDENTITY = "identity"
BY_VERIFIED_EMAIL = "verified_email"
NEW_ACCOUNT = "new"

USERNAME_PREFIX = "sso-"
USERNAME_TRIES = 5
ACCOUNT_GONE = "That account has been deleted. Create a new one to play again."


@dataclass(frozen=True)
class SignIn:
    """The outcome of a social sign-in: who signed in, and how we got there."""

    user: Any
    how: str
    """`identity` (already linked), `verified_email` (linked to an existing account now) or `new`."""

    @property
    def created(self) -> bool:
        return self.how == NEW_ACCOUNT


def _free_username() -> str:
    """An unused opaque username. Nothing of the person's email or name is in it."""
    user_model = get_user_model()
    for _ in range(USERNAME_TRIES):
        candidate = f"{USERNAME_PREFIX}{secrets.token_hex(8)}"
        if not user_model.objects.filter(username=candidate).exists():
            return candidate
    raise IntegrityError("Could not find a free SSO username")


def _display_name(profile: SsoProfile) -> str:
    """The provider's name for the person, trimmed to a display name's length. Blank is allowed: `names.display_name`
    then shows "Player {id}" rather than anything from the address."""
    return profile.name.strip()[:NAME_MAX_LENGTH]


def _linked_user(provider: str, subject: str) -> SocialIdentity | None:
    """The identity for this provider account, with its user and the user's account loaded, so signing in needs no
    further query for the session key."""
    return (
        SocialIdentity.objects.select_related("user", "user__account")
        .filter(provider=provider, subject=subject)
        .first()
    )


def account_for_email(email: str) -> Any:
    """The one active account that email signs in to, or None. Inactive (deleted) rows are never matched."""
    return (
        get_user_model()
        .objects.select_related("account")
        .filter(Q(username=email) | Q(email__iexact=email), is_active=True)
        .order_by("id")
        .first()
    )


def _new_user(profile: SsoProfile) -> Any:
    """A fresh account with no usable password. The email is stored only when the provider verified it."""
    user = get_user_model()(
        username=_free_username(),
        email=profile.email if profile.email_verified else "",
        first_name=_display_name(profile),
    )
    user.set_unusable_password()
    user.save()
    user.account = UserAccount.objects.create(user=user)
    return user


def link_or_create(provider: str, profile: SsoProfile) -> SignIn:
    """The user this sign-in belongs to, linking or creating as the module docstring says, in one transaction."""
    with transaction.atomic():
        identity = _linked_user(provider, profile.subject)
        if identity is not None:
            if not identity.user.is_active:
                raise SsoError(ACCOUNT_UNAVAILABLE, 403, ACCOUNT_GONE)
            identity.email = profile.email
            identity.email_verified = profile.email_verified
            identity.save(update_fields=["email", "email_verified", "last_login_at"])
            return SignIn(user=identity.user, how=BY_IDENTITY)

        user = account_for_email(profile.email) if profile.email_verified else None
        how = BY_VERIFIED_EMAIL if user is not None else NEW_ACCOUNT
        if user is None:
            user = _new_user(profile)
        SocialIdentity.objects.create(
            user=user,
            provider=provider,
            subject=profile.subject,
            email=profile.email,
            email_verified=profile.email_verified,
        )
        return SignIn(user=user, how=how)
