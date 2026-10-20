"""Locations: a name, rich-text content (sanitised by the write serializer) and six d6 results.

Adding and editing need the Locations page switched on and `manage_locations` (owners and admins hold it).
"""

from typing import Any

from django.db.models import QuerySet

from ..models import CampaignLocation


def locations(campaign_id: int) -> QuerySet[CampaignLocation]:
    return CampaignLocation.objects.filter(campaign_id=campaign_id)


def create(campaign_id: int, validated: dict[str, Any]) -> CampaignLocation:
    return CampaignLocation.objects.create(campaign_id=campaign_id, **validated)


def update(location: CampaignLocation, validated: dict[str, Any]) -> CampaignLocation:
    for field, value in validated.items():
        setattr(location, field, value)
    location.save()
    return location
