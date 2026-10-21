"""Changes a user makes to their own account (decisions 1 and 4)."""

from typing import Any

from .tokens import end_all_sessions, issue_tokens


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
