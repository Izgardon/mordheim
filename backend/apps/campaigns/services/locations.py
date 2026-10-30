"""Locations: a name, an optional area (free text), rich-text content (sanitised by the write serializer) and six d6
results.

Adding, editing and removing need the Locations page switched on and `manage_locations` (owners and admins hold it).
Removal is a soft delete (`removed_at`), as for encampments: a removed location is no longer listed.
"""

from typing import Any

from django.db.models import QuerySet
from django.utils import timezone

from ..models import CampaignLocation


def locations(campaign_id: int) -> QuerySet[CampaignLocation]:
    """The listed locations (not removed)."""
    return CampaignLocation.objects.filter(campaign_id=campaign_id, removed_at__isnull=True)


def create(campaign_id: int, validated: dict[str, Any]) -> CampaignLocation:
    return CampaignLocation.objects.create(campaign_id=campaign_id, **validated)


def update(location: CampaignLocation, validated: dict[str, Any]) -> CampaignLocation:
    for field, value in validated.items():
        setattr(location, field, value)
    location.save()
    return location


def remove(location: CampaignLocation, by: Any) -> None:
    """Remove it from the list (a soft delete)."""
    CampaignLocation.objects.filter(id=location.id).update(removed_at=timezone.now(), removed_by=by)
