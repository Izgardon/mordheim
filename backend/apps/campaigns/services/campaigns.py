"""Creating a campaign (BUG-76): the campaign, its settings and the owner's membership in one transaction; its join
code, and a new one when owners or admins want the old one to stop working (decision 1, CAMP-NEW-01)."""

import random
import string
from typing import Any

from django.db import transaction

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


def create_campaign(owner: Any, validated: dict[str, Any]) -> Campaign:
    """A new campaign with `owner` as its owner, from CampaignCreateSerializer's data; all or nothing. Its settings
    in play are the ones sent, else its preset's (Up to 1c by default, in_play.py)."""
    picked = validated.get("setting_ids")
    setting_ids = (
        [row.pk for row in picked] if picked is not None else preset_ids(validated.get("preset", DEFAULT_PRESET))
    )
    with transaction.atomic():
        campaign = Campaign.objects.create(name=validated["name"], join_code=unique_join_code())
        CampaignSettings.objects.create(
            campaign=campaign,
            max_players=validated.get("max_players", 8),
            max_heroes=validated.get("max_heroes", 6),
            max_hired_swords=validated.get("max_hired_swords", 3),
            max_games=validated.get("max_games", 10),
            starting_gold=validated.get("starting_gold", 500),
            enable_encampments=validated.get("enable_encampments", False),
            enable_locations=validated.get("enable_locations", False),
        )
        set_settings(campaign, setting_ids)
        CampaignMembership.objects.create(campaign=campaign, user=owner, role_id=codes.role_ref(OWNER))
    return campaign


def regenerate_join_code(campaign_id: int) -> str:
    """Give the campaign a new join code; the old one stops working at once (decision 1, CAMP-NEW-01)."""
    code = unique_join_code()
    Campaign.objects.filter(id=campaign_id).update(join_code=code)
    return code
