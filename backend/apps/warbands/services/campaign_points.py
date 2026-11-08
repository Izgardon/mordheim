"""Campaign points (William, 7 Nov 2026: "campaign points campaign wide setting - if enabled adds another mandatory
resource called campaign points"; "Sort later just add now"): with `CampaignSettings.enable_campaign_points` on, every
warband of the campaign holds a Campaign points counter (`WarbandResource.is_campaign_points`), at 0 to begin with,
never renamed, deleted or sold (William, 8 Nov 2026: "it isnt sellable, just the +-"), and changed like any
resource. Switched off, the counters stay with their amounts
but are hidden: no list, summary or sheet shows them, no write reaches them and no fee pays from them; switched on
again, they come back as they were.

A fee naming Campaign points pays from the counter of that name already (apps/hirelings/fees.py `RESOURCE_NAMES`).
"""

from collections.abc import Iterable
from typing import Any

from django.db.models import Q, QuerySet

from apps.warbands.models import Warband, WarbandResource

CAMPAIGN_POINTS = "Campaign points"
# a counter shown: not campaign points, or its campaign has them on (for queries that don't hold the warband)
SHOWN = Q(is_campaign_points=False) | Q(warband__campaign__settings__enable_campaign_points=True)


def campaign_points_on(warband: Warband) -> bool:
    """Whether the warband's campaign has campaign points on (its settings are read with the warband)."""
    settings = getattr(warband.campaign, "settings", None)
    return bool(settings and settings.enable_campaign_points)


def shown_resources(warband: Warband, resources: Iterable[WarbandResource]) -> list[WarbandResource]:
    """The warband's counters as they are shown: campaign points only while its campaign has them on."""
    rows = list(resources)
    if any(row.is_campaign_points for row in rows) and not campaign_points_on(warband):
        return [row for row in rows if not row.is_campaign_points]
    return rows


def resource_rows(warband: Warband) -> "QuerySet[WarbandResource]":
    """The warband's counters a request may read or change: hidden campaign points are left out."""
    rows = WarbandResource.objects.filter(warband=warband)
    return rows if campaign_points_on(warband) else rows.exclude(is_campaign_points=True)


def give_campaign_points(warband_ids: Iterable[int]) -> None:
    """Each warband named holds its Campaign points: one it holds already keeps its amount, else a resource of that
    name it has (in any case) becomes them, else they start at 0. Four queries at most, however many warbands; the
    caller holds the transaction."""
    ids = set(warband_ids)
    held = WarbandResource.objects.filter(warband_id__in=ids, is_campaign_points=True)
    missing = ids - set(held.values_list("warband_id", flat=True))
    named = WarbandResource.objects.filter(warband_id__in=missing, is_default=False, name__iexact=CAMPAIGN_POINTS)
    adopted: dict[int, Any] = {}
    for row in named.order_by("id").values("id", "warband_id"):
        adopted.setdefault(row["warband_id"], row["id"])
    if adopted:
        WarbandResource.objects.filter(id__in=adopted.values()).update(is_campaign_points=True)
    WarbandResource.objects.bulk_create(
        WarbandResource(warband_id=warband_id, name=CAMPAIGN_POINTS, amount=0, is_campaign_points=True)
        for warband_id in sorted(missing - set(adopted))
    )
