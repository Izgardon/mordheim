"""Encampments: a name, a description and an owner, with no game effect (decision 9, CAMP-TWEAK-08).

Any member adds one while the Encampments page is switched on, and picks its owner from the campaign's members
(by default himself). The encampment's owner, or anyone holding `manage_encampments` (owners and admins hold it),
edits it, reassigns it or removes it; removal is a soft delete (`removed_at`), and a removed encampment is no longer
listed. An encampment whose owner has left the campaign keeps him, marked `owner_left` (shown "(left)").
"""

from typing import Any

from django.db.models import Exists, OuterRef, QuerySet
from django.utils import timezone

from ..models import CampaignEncampment, CampaignMembership


def encampments(campaign_id: int) -> QuerySet[CampaignEncampment]:
    """The listed encampments, each with whether its owner is still a member (`owner_is_member`)."""
    still_member = CampaignMembership.objects.filter(campaign_id=OuterRef("campaign_id"), user_id=OuterRef("owner_id"))
    rows = CampaignEncampment.objects.filter(campaign_id=campaign_id, removed_at__isnull=True)
    return rows.select_related("owner").annotate(owner_is_member=Exists(still_member))


def create(campaign_id: int, creator: Any, validated: dict[str, Any]) -> CampaignEncampment:
    """A new encampment, owned by `owner_id` when sent (None: nobody), else by its creator."""
    fields = dict(validated)
    owner_id = fields.pop("owner_id") if "owner_id" in fields else creator.id
    entry = CampaignEncampment.objects.create(campaign_id=campaign_id, owner_id=owner_id, **fields)
    entry.owner_is_member = True  # type: ignore[attr-defined]  # a member or nobody (the serializer checked)
    return entry


def update(encampment: CampaignEncampment, validated: dict[str, Any]) -> CampaignEncampment:
    fields = dict(validated)
    if "owner_id" in fields:
        encampment.owner_id = fields.pop("owner_id")
        encampment.owner_is_member = True  # type: ignore[attr-defined]  # a member or nobody (checked)
    for field, value in fields.items():
        setattr(encampment, field, value)
    encampment.save()
    return encampment


def remove(encampment: CampaignEncampment, by: Any) -> None:
    """Remove it from the list (a soft delete)."""
    CampaignEncampment.objects.filter(id=encampment.id).update(removed_at=timezone.now(), removed_by=by)
