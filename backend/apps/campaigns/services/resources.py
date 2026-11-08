"""The campaign's resources (William, 7 Nov 2026: "resource options should be options from the campaigns resources that
still exist"): the names its warbands' counters hold now, which a hired sword's or dramatis persona's hire fee or upkeep
picks its one resource from. Gold is the fee's own gold and never one of them."""

from typing import Any

from apps.hirelings.fees import is_gold
from apps.warbands.models import WarbandResource
from apps.warbands.services.campaign_points import CAMPAIGN_POINTS

from ..models import DEFAULT_RESOURCE_NAME, CampaignSettings


def _row(name: str, *, default: bool = False, campaign_points: bool = False) -> dict[str, Any]:
    return {"name": name, "is_default": default, "is_campaign_points": campaign_points}


def campaign_resources(campaign_id: int) -> list[dict[str, Any]]:
    """The default resource first, as the settings name it (every warband has it, even before one is raised), then
    Campaign points while they are on, then every other name a warband's counter holds, once each whatever its case,
    by name. Two queries."""
    settings = (
        CampaignSettings.objects.filter(campaign_id=campaign_id)
        .only("default_resource_name", "enable_campaign_points")
        .first()
    )
    rows = [_row((settings.default_resource_name if settings else "") or DEFAULT_RESOURCE_NAME, default=True)]
    if settings and settings.enable_campaign_points:
        rows.append(_row(CAMPAIGN_POINTS, campaign_points=True))
    taken = {row["name"].strip().casefold() for row in rows}
    held = (
        WarbandResource.objects.filter(warband__campaign_id=campaign_id, is_default=False, is_campaign_points=False)
        .values_list("name", flat=True)
        .distinct()
    )
    others: dict[str, str] = {}
    for name in held:
        key = name.strip().casefold()
        if key and key not in taken and not is_gold(name):
            others.setdefault(key, name.strip())
    return rows + [_row(others[key]) for key in sorted(others)]
