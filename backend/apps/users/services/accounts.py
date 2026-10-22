"""What happens to a user's account: signing up and in, resetting, changing and setting a password, signing out
everywhere else, and renaming (decisions 1, 2 and 4). The views parse and answer; the session key itself lives in
`tokens`.
"""

from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import update_last_login
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from apps.campaigns.services.authors import restamp_author_names

from ..models import UserAccount
from .tokens import end_all_sessions, issue_tokens

RESET_PATH = "/reset-password"


class EmailTaken(Exception):
    """Another account holds the address: a sign-up that raced another for it lost (BUG-84)."""


def create_account(email: str, name: str, password: str) -> Any:
    """A new user (the username is the email, the name is `first_name`) with the account holding their session key, in
    one savepoint (SEC-05). Raises EmailTaken when a simultaneous sign-up took the address first (BUG-84)."""
    user = get_user_model()(username=email, email=email, first_name=name)
    user.set_password(password)
    try:
        with transaction.atomic():
            user.save()
            UserAccount.objects.create(user=user)
    except IntegrityError:
        raise EmailTaken from None
    return user


def sign_in(user: Any) -> dict[str, str]:
    """A pair for the device signing in. last_login is recorded first: reset tokens hash it, so a sign-in spends any
    outstanding link (BUG-154)."""
    update_last_login(type(user), user)
    return issue_tokens(user)


def set_new_password(user: Any, password: str) -> None:
    """Store a new (already validated) password and end every session: a reset or a password change (2 queries).

    The session key changes first, so should the password's save fail, the old password still signs in."""
    end_all_sessions(user)
    user.set_password(password)
    user.save(update_fields=["password"])


def change_password(user: Any, password: str) -> dict[str, str]:
    """The password change (AUTH-NEW-03): every other device is signed out; this one gets a fresh pair."""
    set_new_password(user, password)
    return issue_tokens(user)


def sign_out_others(user: Any) -> dict[str, str]:
    """Sign out everywhere else (AUTH-NEW-04): a new session key, and a fresh pair for this device (1 query)."""
    end_all_sessions(user)
    return issue_tokens(user)


def rename(user: Any, name: str) -> None:
    """Change the display name (AUTH-NEW-02, decision 2), and the name stored on the user's chat messages and bulletin
    notes with it, in one transaction."""
    with transaction.atomic():
        user.first_name = name
        user.save(update_fields=["first_name"])
        restamp_author_names(user)


def reset_link_for(email: str) -> tuple[str, str] | None:
    """The address to send a reset email to and the link it carries, or None when no active user has that (lowercased)
    email. The user is found by username, which is the lowercased email, as sign-in finds them: an indexed match, where
    `email__iexact OR username__iexact` scanned the table (IMP-95 c). They're loaded whole: the token reads last_login
    and the password, so a known address costs the one query an unknown one does (BUG-153)."""
    user = get_user_model().objects.filter(username=email, is_active=True).first()
    if user is None:
        return None
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = PasswordResetTokenGenerator().make_token(user)
    # uid and token ride in the fragment, which browsers never send to a server, so they stay out of access logs; the
    # page strips it once read (SEC-12)
    return user.email or email, f"{settings.FRONTEND_URL.rstrip('/')}{RESET_PATH}#uid={uid}&token={token}"


def user_for_reset_link(uid: str, token: str) -> Any:
    """The active user a reset link names, while its token is still good; else None. A uid that decodes to something
    other than an id (letters, or nothing) is refused like any other bad link, as Django's own reset view does
    (BUG-83)."""
    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = get_user_model().objects.filter(pk=user_id, is_active=True).first()
    except (TypeError, ValueError, OverflowError, ValidationError):
        return None
    if user is None or not PasswordResetTokenGenerator().check_token(user, token):
        return None
    return user
