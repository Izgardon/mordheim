"""The campaign PATCH (BUG-76): the start flag, the settings and the warbands it adjusts, in one transaction."""

from typing import Any

from django.db import transaction

from apps.core.catalogue.cache import bump

from ..errors import Refused
from ..in_play import set_settings
from ..models import Campaign, CampaignSettings
from . import starting_gold

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


START_FIELDS = frozenset({"in_progress"})
UPDATE_FIELDS = frozenset({*START_FIELDS, *SETTINGS_FIELDS, "name", "setting_ids", starting_gold.ADJUST_FLAG})


def rule_for(data: Any) -> str:
    """The rule a PATCH needs (access.CAMPAIGN_RULES): `start` (owners and admins, decision 2, BUG-13) when it sends
    nothing but the start flag, else `edit_settings` (the owner)."""
    sent = set(data) & UPDATE_FIELDS if isinstance(data, dict) else set()
    return "start" if sent <= START_FIELDS else "edit_settings"


def update_campaign(campaign: Campaign, validated: dict[str, Any]) -> None:
    """Apply CampaignUpdateSerializer's data (only the fields sent); all or nothing."""
    if not set(validated) - {starting_gold.ADJUST_FLAG}:
        raise Refused("No updates provided.")
    old_gold = starting_gold.changed_from(campaign, validated)
    settings_updates = {field: validated[field] for field in SETTINGS_FIELDS if field in validated}
    picked = validated.get("setting_ids")
    with transaction.atomic():
        if "in_progress" in validated:
            campaign.in_progress = validated["in_progress"]
            campaign.save(update_fields=["in_progress"])
        if "name" in validated:  # a rename (the owner, next step 7b)
            campaign.name = validated["name"]
            campaign.save(update_fields=["name"])
        if picked is not None:  # the settings in play (grading phase 1): every catalogue list's in_play changes
            set_settings(campaign, [row.pk for row in picked])
            bump(campaign.id)  # no catalogue.changed: the pages read the lists again on campaign.updated
        if not settings_updates:
            return
        settings, _ = CampaignSettings.objects.get_or_create(campaign=campaign)
        for field, value in settings_updates.items():
            setattr(settings, field, value)
        settings.save(update_fields=list(settings_updates))
        if old_gold is not None and validated.get(starting_gold.ADJUST_FLAG):
            starting_gold.adjust_warbands(campaign, old_gold, settings_updates["starting_gold"])
