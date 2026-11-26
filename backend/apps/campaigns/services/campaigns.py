"""Creating a campaign (BUG-76): the campaign, its settings and the owner's membership in one transaction; its join
code, and a new one when owners or admins want the old one to stop working (decision 1, CAMP-NEW-01)."""

import random
import string
from typing import Any

from django.db import transaction

from apps.campaign_presets.services import apply as presets_apply
from apps.campaign_presets.services import charts as preset_charts
from apps.campaign_presets.services import encampments as preset_encampments
from apps.campaign_presets.services import locations as preset_locations
from apps.campaign_presets.services import rules as preset_rules
from apps.campaign_presets.services.preset_lists import build_lists
from apps.campaign_presets.services.skill_wordings import apply_skill_wordings
from apps.exploration.selectors import book_chart_id

from ..constants import OWNER
from ..in_play import DEFAULT_PRESET, preset_ids, set_settings
from ..models import Campaign, CampaignMembership, CampaignSettings
from . import codes

JOIN_CODE_ALPHABET = string.ascii_uppercase + string.digits


def _generate_join_code() -> str:
    return "".join(random.choice(JOIN_CODE_ALPHABET) for _ in range(6))


def unique_join_code() -> str:
    """Six capital letters or digits no campaign uses (the unique column has the last word)."""
    for _ in range(20):
        code = _generate_join_code()
        if not Campaign.objects.filter(join_code=code).exists():
            return code
    return _generate_join_code()


CREATE_DEFAULTS: dict[str, Any] = {  # what a campaign starts on when neither its creator nor its preset says
    "max_players": 8,
    "max_heroes": 6,
    "max_hired_swords": 3,
    "max_games": 10,
    "starting_gold": 500,
    "enable_encampments": False,
    "enable_locations": False,
}


def settings_at_creation(validated: dict[str, Any], preset: Any) -> dict[str, Any]:
    """The new campaign's settings row: the app's defaults, then what its preset dictates, then what its creator
    sent, which wins (he can depart from the preset as he creates, as he can afterwards). It explores by the book's
    Mordheim chart unless its preset or its creator names another, and it is given that chart rather than left to
    read it out of a null (none seeded yet: null, which reads as that chart all the same)."""
    sent = {field: validated[field] for field in CREATE_DEFAULTS if field in validated}
    return {
        **CREATE_DEFAULTS,
        "exploration_chart_id": book_chart_id(),  # Mordheim's, not a null that means it (William, 16 Nov 2026)
        **presets_apply.settings_values(preset),
        **sent,
    }


def create_campaign(owner: Any, validated: dict[str, Any]) -> Campaign:
    """A new campaign with `owner` as its owner, from CampaignCreateSerializer's data; all or nothing. Its settings
    in play are the ones sent, else its grade preset's (Up to 1c by default, in_play.py), with the settings its
    campaign preset guides towards added, and its preset's rules **and charts** are copied into its own in order
    (William, 20 Nov 2026: a Marienburg campaign "has no charts, it has the rest of the rules" -- creation copied
    the rules and stopped, so the charts only arrived if someone later asked for the preset's rules again)."""
    picked = validated.get("setting_ids")
    setting_ids = (
        [row.pk for row in picked] if picked is not None else preset_ids(validated.get("preset", DEFAULT_PRESET))
    )
    preset = validated.get("preset_id")  # the published campaign it plays (apps/campaign_presets)
    values = settings_at_creation(validated, preset)
    with transaction.atomic():
        campaign = Campaign.objects.create(name=validated["name"], join_code=unique_join_code(), preset=preset)
        CampaignSettings.objects.create(campaign=campaign, **values)
        ticked = presets_apply.ticked_with(campaign.pk, preset, setting_ids)
        set_settings(campaign, ticked if ticked is not None else setting_ids)
        # its scenarios and plots are its preset's alone, whatever it ticks for content (William, 26 Nov 2026)
        build_lists(campaign.pk, campaign.preset_id, plots=bool(values.get("enable_campaign_points")))
        preset_rules.copy_rules(campaign, preset)
        preset_charts.copy_charts(campaign, preset)
        preset_locations.copy_locations(campaign, preset)  # after the charts, which its locations point to
        preset_encampments.copy_encampments(campaign, preset)
        apply_skill_wordings(campaign.pk, preset)  # its own wording of book skills (the Annual's Mighty Blow)
        CampaignMembership.objects.create(campaign=campaign, user=owner, role_id=codes.role_ref(OWNER))
    return campaign


def regenerate_join_code(campaign_id: int) -> str:
    """Give the campaign a new join code; the old one stops working at once (decision 1, CAMP-NEW-01)."""
    code = unique_join_code()
    Campaign.objects.filter(id=campaign_id).update(join_code=code)
    return code
