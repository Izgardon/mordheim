"""The author's name stored on campaign chat messages (SEC-13): rewritten when they rename, so their posts show the
new name (AUTH-NEW-02). Notifications already sent keep the old one."""

from typing import Any

from apps.users.names import display_name

from ..models import CampaignMessage


def restamp_author_names(user: Any) -> None:
    """Every message the user wrote, removed ones included, takes their current display name (1 query)."""
    CampaignMessage.objects.filter(user=user).update(username=display_name(user))
