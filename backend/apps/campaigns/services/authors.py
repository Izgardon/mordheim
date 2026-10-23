"""The author's name stored on campaign chat messages and bulletin notes (SEC-13): rewritten when they rename, so
their posts show the new name (AUTH-NEW-02). Notifications already sent keep the old one."""

from typing import Any

from apps.users.names import display_name

from ..models import CampaignBulletinEntry, CampaignMessage


def restamp_author_names(user: Any) -> None:
    """Every message and note the user wrote, removed ones included, takes their current display name (2 queries)."""
    name = display_name(user)
    CampaignMessage.objects.filter(user=user).update(username=name)
    CampaignBulletinEntry.objects.filter(user=user).update(username=name)
