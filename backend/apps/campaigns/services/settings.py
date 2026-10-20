"""The campaign PATCH (BUG-76): the start flag, the settings and the warbands it touches, in one transaction."""

from typing import Any

from django.db import transaction

from apps.warbands.models import Warband
from apps.warbands.restrictions import get_valid_campaign_item_settings
from apps.warbands.services import ledger

from ..errors import Refused
from ..models import Campaign, CampaignSettings

SETTINGS_FIELDS = (
    "max_heroes",
    "max_hired_swords",
    "starting_gold",
    "hero_death_roll",
    "enable_encampments",
    "enable_locations",
    "hero_level_thresholds",
    "henchmen_level_thresholds",
    "hired_sword_level_thresholds",
)


def update_campaign(campaign: Campaign, validated: dict[str, Any]) -> None:
    """Apply CampaignUpdateSerializer's data (only the fields sent); all or nothing."""
    if not validated:
        raise Refused("No updates provided.")
    settings_updates = {field: validated[field] for field in SETTINGS_FIELDS if field in validated}
    item_setting_ids = validated.get("item_setting_ids")
    with transaction.atomic():
        if "in_progress" in validated:
            campaign.in_progress = validated["in_progress"]
            campaign.save(update_fields=["in_progress"])
        if not settings_updates and item_setting_ids is None:
            return
        settings, _ = CampaignSettings.objects.get_or_create(campaign=campaign)
        for field, value in settings_updates.items():
            setattr(settings, field, value)
        if settings_updates:
            settings.save(update_fields=list(settings_updates))
        if item_setting_ids is not None:
            settings.item_settings.set(get_valid_campaign_item_settings(item_setting_ids))
        if "starting_gold" in settings_updates:
            for warband in Warband.objects.filter(campaign=campaign):
                ledger.rewrite_starting_gold(warband, settings_updates["starting_gold"])
