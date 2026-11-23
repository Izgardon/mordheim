"""The campaign's resources (William, 7 Nov 2026: "resource options should be options from the campaigns resources that
still exist"): the names its warbands' counters hold now, which a hired sword's or dramatis persona's hire fee or upkeep
picks its one resource from. Gold is the fee's own gold and never one of them.

Campaign points are a name a fee may charge in, not a counter (`is_campaign_points`): a fee naming them is the
player's own to pay (apps/hirelings/fees.py), so they are offered while the setting is on and nothing holds them.
"""

from typing import Any

from apps.campaign_presets.services.resources import other_resources
from apps.hirelings.fees import CAMPAIGN_POINTS, is_gold
from apps.warbands.models import WarbandResource

from ..models import DEFAULT_RESOURCE_NAME, CampaignSettings


def _row(name: str, *, default: bool = False, campaign_points: bool = False) -> dict[str, Any]:
    return {"name": name, "is_default": default, "is_campaign_points": campaign_points}


def campaign_resources(campaign_id: int) -> list[dict[str, Any]]:
    """The default resource first, as the settings name it (every warband has it, even before one is raised), then
    the others its preset keeps for every warband, then Campaign points while they are on, then every other name a
    warband's counter holds, once each whatever its case, by name. Two queries."""
    settings = (
        CampaignSettings.objects.filter(campaign_id=campaign_id)
        .select_related("campaign__preset")
        .only(
            "default_resource_name",
            "enable_campaign_points",
            "campaign__preset__main_resource",
            "campaign__preset__resources",
        )
        .first()
    )
    rows = [_row((settings.default_resource_name if settings else "") or DEFAULT_RESOURCE_NAME, default=True)]
    rows += [_row(name) for name in other_resources(settings.campaign.preset if settings else None)]
    if settings and settings.enable_campaign_points:
        rows.append(_row(CAMPAIGN_POINTS, campaign_points=True))  # a name only: no warband holds a counter of it
    taken = {row["name"].strip().casefold() for row in rows}
    held = (
        WarbandResource.objects.filter(warband__campaign_id=campaign_id, is_default=False)
        .values_list("name", flat=True)
        .distinct()
    )
    others: dict[str, str] = {}
    for name in held:
        key = name.strip().casefold()
        if key and key not in taken and not is_gold(name):
            others.setdefault(key, name.strip())
    return rows + [_row(others[key]) for key in sorted(others)]
