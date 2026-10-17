"""The whole warband sheet in one payload (PERF-24).

Warband detail, summary, capabilities and the three unit lists in detail shape, the same bodies the
separate endpoints return, in a fixed number of queries however big the roster is: each unit table and
join table is read once, the item details once for every item on the roster, and the summary's unit
lists and rating come from the units already loaded.
"""

from typing import Any

from django.db.models import prefetch_related_objects

from apps.campaigns.models import CampaignMembership
from apps.warbands.access import warband_capabilities
from apps.warbands.models import HenchmenGroup, Hero, HiredSword, Warband
from apps.warbands.prefetches import (
    HENCHMEN_GROUP_SUMMARY_PREFETCH,
    HERO_SUMMARY_PREFETCH,
    HIRED_SWORD_SUMMARY_PREFETCH,
    alive_henchmen_prefetch,
    item_detail_prefetches,
)
from apps.warbands.serializers import (
    HenchmenGroupDetailSerializer,
    HeroDetailSerializer,
    HiredSwordDetailSerializer,
    WarbandSerializer,
    WarbandSummarySerializer,
)
from apps.warbands.services.summary import WarbandUnits


def _summary_units(heroes: list[Hero], groups: list[HenchmenGroup], swords: list[HiredSword]) -> WarbandUnits:
    """The rows `load_warband_units` would read, taken from the loaded roster."""
    return WarbandUnits(
        heroes=[
            {
                "id": h.id,
                "warband_id": h.warband_id,
                "name": h.name,
                "unit_type": h.unit_type,
                "xp": h.xp,
                "large": h.large,
            }
            for h in heroes
        ],
        henchmen_groups=[
            {
                "id": g.id,
                "warband_id": g.warband_id,
                "name": g.name,
                "unit_type": g.unit_type,
                "xp": g.xp,
                "large": g.large,
                "henchmen_count": len(g.henchmen.all()),  # the prefetch holds living members only
            }
            for g in groups
        ],
        hired_swords=[
            {
                "id": s.id,
                "warband_id": s.warband_id,
                "name": s.name,
                "unit_type": s.unit_type,
                "rating": s.rating,
                "xp": s.xp,
            }
            for s in swords
        ],
    )


def warband_sheet(warband: Warband, user: Any, membership: CampaignMembership) -> dict[str, Any]:
    heroes = list(
        Hero.objects.filter(warband=warband, dead=False)
        .select_related("race")
        .prefetch_related(*HERO_SUMMARY_PREFETCH)
        .order_by("id")
    )
    groups = list(
        HenchmenGroup.objects.filter(warband=warband, dead=False)
        .select_related("race")
        .prefetch_related(*HENCHMEN_GROUP_SUMMARY_PREFETCH, alive_henchmen_prefetch())
        .order_by("id")
    )
    swords = list(
        HiredSword.objects.filter(warband=warband, dead=False)
        .select_related("race")
        .prefetch_related(*HIRED_SWORD_SUMMARY_PREFETCH)
        .order_by("id")
    )
    items = [link.item for hero in heroes for link in hero.hero_items.all()]
    items += [link.item for group in groups for link in group.henchmen_group_items.all()]
    items += [link.item for sword in swords for link in sword.hired_sword_items.all()]
    prefetch_related_objects(items, *item_detail_prefetches())

    summary_context = {"warband_units": _summary_units(heroes, groups, swords)}
    return {
        "warband": WarbandSerializer(warband).data,
        "summary": WarbandSummarySerializer(warband, context=summary_context).data,
        "capabilities": warband_capabilities(user, warband, membership),
        "heroes": HeroDetailSerializer(heroes, many=True).data,
        "henchmen_groups": HenchmenGroupDetailSerializer(groups, many=True).data,
        "hired_swords": HiredSwordDetailSerializer(swords, many=True).data,
    }
