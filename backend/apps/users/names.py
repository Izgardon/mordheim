"""What other players see of a user (SEC-13, CAMP-TEST-27).

Registration makes the username the email, so a "first name, else username" fallback showed a player's email to
everyone in his campaigns. Every name shown to other players goes through `display_name`; only owners and admins
see emails, in the members list's own `email` field.
"""

from typing import Any

FORMER_PLAYER = "Former player"  # the name of a deleted account, on everything of theirs that stays (decision 1)


def display_name(user: Any) -> str:
    """The user's first name, else "Player {id}"; never his email or username."""
    first_name = str(getattr(user, "first_name", "") or "").strip()
    return first_name or f"Player {user.id}"
