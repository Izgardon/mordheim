"""Encampments: a name, an owner (a member, or nobody) and a description, with no game effect (decision 9).

Adding and editing need the Encampments page switched on and `manage_encampments` (owners and admins hold it); the
write serializer checks that the owner is a member.
"""

from typing import Any

from django.db.models import QuerySet

from ..models import CampaignEncampment


def encampments(campaign_id: int) -> QuerySet[CampaignEncampment]:
    return CampaignEncampment.objects.filter(campaign_id=campaign_id).select_related("owner")


def create(campaign_id: int, validated: dict[str, Any]) -> CampaignEncampment:
    fields = dict(validated)
    owner_id = fields.pop("owner_id", None)
    return CampaignEncampment.objects.create(campaign_id=campaign_id, owner_id=owner_id, **fields)


def update(encampment: CampaignEncampment, validated: dict[str, Any]) -> CampaignEncampment:
    fields = dict(validated)
    if "owner_id" in fields:
        encampment.owner_id = fields.pop("owner_id")
    for field, value in fields.items():
        setattr(encampment, field, value)
    encampment.save()
    return encampment
