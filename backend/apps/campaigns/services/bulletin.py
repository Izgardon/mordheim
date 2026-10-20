"""The campaign bulletin board: notes of up to 280 characters, newest first; only a note's author deletes it."""

from typing import Any

from django.db.models import QuerySet

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


def delete(entry: CampaignBulletinEntry) -> None:
    entry.delete()
