"""The campaign PATCH (BUG-76): the start flag, the settings and the warbands it adjusts, in one transaction."""

from typing import Any

from django.db import transaction

from apps.campaign_presets.services import apply as presets_apply
from apps.campaign_presets.services.resources import apply_resources
from apps.campaign_presets.services.swap import swap_rules
from apps.core.catalogue.cache import bump
from apps.plots.writes import give_default_plots

from ..errors import Refused
from ..in_play import set_settings
from ..models import DEFAULT_RESOURCE_NAME, Campaign, CampaignSettings
from . import starting_gold
from .default_resource import rename_default_resources

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
    "default_resource_name",
    "wyrdstone_prices",
    "enable_campaign_points",
    "enable_blood_pacts",
    "exploration_chart_id",
)


START_FIELDS = frozenset({"in_progress"})
UPDATE_FIELDS = frozenset(
    {*START_FIELDS, *SETTINGS_FIELDS, "name", "setting_ids", "preset_id", starting_gold.ADJUST_FLAG}
)


def rule_for(data: Any) -> str:
    """The rule a PATCH needs (access.CAMPAIGN_RULES): `start` (owners and admins, decision 2, BUG-13) when it sends
    nothing but the start flag, else `edit_settings` (the owner)."""
    sent = set(data) & UPDATE_FIELDS if isinstance(data, dict) else set()
    return "start" if sent <= START_FIELDS else "edit_settings"


def update_campaign(campaign: Campaign, validated: dict[str, Any]) -> list[dict[str, Any]]:
    """Apply CampaignUpdateSerializer's data (only the fields sent); all or nothing. Returns what went ahead with a
    warning (a default resource rename that merged)."""
    if not set(validated) - {starting_gold.ADJUST_FLAG}:
        raise Refused("No updates provided.")
    old_gold = starting_gold.changed_from(campaign, validated)
    settings_updates = {field: validated[field] for field in SETTINGS_FIELDS if field in validated}
    picked = validated.get("setting_ids")
    picked_ids = None if picked is None else [row.pk for row in picked]
    # the published campaign it plays: what it dictates is applied, then what this request sends, which wins; the
    # settings it guides towards are ticked on top of the campaign's own, and its rules and charts are swapped in
    # there and then (William, 20 Nov 2026: "When changing campaign it should swap the rules then and there")
    preset = validated.get("preset_id") if "preset_id" in validated else None
    if preset is not None:
        settings_updates = {**presets_apply.settings_values(preset), **settings_updates}
        picked_ids = presets_apply.ticked_with(campaign.pk, preset, picked_ids)
    with transaction.atomic():
        if "preset_id" in validated:
            campaign.preset = preset
            campaign.save(update_fields=["preset"])
            # out go the rules and charts still another published campaign's word for word, in come this one's;
            # what the player wrote or edited is his and stays (campaign_presets/services/swap.py)
            swap_rules(campaign, preset)
        if "in_progress" in validated:
            campaign.in_progress = validated["in_progress"]
            campaign.save(update_fields=["in_progress"])
        if "name" in validated:  # a rename (the owner, next step 7b)
            campaign.name = validated["name"]
            campaign.save(update_fields=["name"])
        if picked_ids is not None:  # the settings in play (grading phase 1): every list's in_play changes
            set_settings(campaign, picked_ids)
            bump(campaign.id)  # no catalogue.changed: the pages read the lists again on campaign.updated
        if not settings_updates:
            _settle_resources(campaign, validated, preset)
            return []
        # locked: a warband raised meanwhile gets the default resource's name and its campaign points either way
        settings, _ = CampaignSettings.objects.select_for_update().get_or_create(campaign=campaign)
        old_resource = settings.default_resource_name or DEFAULT_RESOURCE_NAME
        old_chart = settings.exploration_chart_id
        for field, value in settings_updates.items():
            setattr(settings, field, value)
        settings.save(update_fields=list(settings_updates))
        if old_gold is not None and validated.get(starting_gold.ADJUST_FLAG):
            starting_gold.adjust_warbands(campaign, old_gold, settings_updates["starting_gold"])
        if settings_updates.get("enable_campaign_points"):  # on: the campaign is given its settings' plots
            give_default_plots(campaign.id)
        if "exploration_chart_id" in settings_updates and settings_updates["exploration_chart_id"] != old_chart:
            bump(campaign.id, "exploration_charts")  # the campaign's cached chart body is another chart now
        renamed = settings_updates.get("default_resource_name", old_resource)
        warnings = rename_default_resources(campaign, renamed) if renamed != old_resource else []
        _settle_resources(campaign, validated, preset)
        return warnings


def _settle_resources(campaign: Campaign, validated: dict[str, Any], preset: Any) -> None:
    """A preset taken up (or cleared): its other resources become every warband's fixed counters, once the default
    resource carries its main resource's name, so a warband's old default is never taken for one of them."""
    if "preset_id" in validated:
        apply_resources(campaign.pk, preset)
