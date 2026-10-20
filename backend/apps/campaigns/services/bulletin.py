"""The campaign bulletin board: notes of up to 280 characters, newest first. Its author, an owner or an admin removes
a note (decision 8): a soft delete, so it stays listed as removed (by its author, or "removed by admin")."""

from typing import Any

from django.db.models import QuerySet
from django.utils import timezone

from apps.users.names import display_name

from ..models import CampaignBulletinEntry


def entries(campaign_id: int) -> QuerySet[CampaignBulletinEntry]:
    return CampaignBulletinEntry.objects.filter(campaign_id=campaign_id).select_related("user")


def post(campaign_id: int, user: Any, body: str) -> CampaignBulletinEntry:
    return CampaignBulletinEntry.objects.create(
        campaign_id=campaign_id,
        user=user,
        username=display_name(user),  # SEC-13: never the email
        body=body,
    )


def remove(entry: CampaignBulletinEntry, by: Any) -> None:
    """Remove the note for everyone (a second remove changes nothing)."""
    rows = CampaignBulletinEntry.objects.filter(id=entry.id, removed_at__isnull=True)
    rows.update(removed_at=timezone.now(), removed_by=by)
