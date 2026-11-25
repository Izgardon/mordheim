"""The whole warband sheet in one payload (PERF-24).

Warband detail, summary, capabilities, its rules, the plot it follows and the three unit lists in detail shape, the
same bodies the separate endpoints return, in a fixed number of queries however big the roster is: each unit table and
join table is read once, the item details once for every item on the roster, and the summary's unit
lists and rating come from the units already loaded.
"""

from typing import Any

from django.db.models import prefetch_related_objects

from apps.campaigns.services.encampments import held_by
from apps.plots.selectors import warband_plot
from apps.warband_templates.services.item_names import template_item_names
from apps.warbands.models import Warband
from apps.warbands.prefetches import item_detail_prefetches
from apps.warbands.serializers import (
    UNIT_SERIALIZERS,
    WarbandRuleSerializer,
    WarbandSerializer,
    WarbandSummarySerializer,
)
from apps.warbands.services.loadouts import group_mount_rating_of
from apps.warbands.services.summary import WarbandUnits, load_warband_units
from apps.warbands.units.companions import mount_bonuses
from apps.warbands.units.kinds import HENCHMEN_GROUP, HERO, HIRELING, KINDS


def _summary_units(rosters: dict[str, list[Any]]) -> WarbandUnits:
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
                "missing_games": h.missing_games,
                "mount_bonuses": mount_bonuses(h.hero_items.all()),
            }
            for h in rosters[HERO.key]
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
                "rated_count": len(present := [m for m in g.henchmen.all() if not m.missing_games]),
                "mount_rating": group_mount_rating_of(g.henchmen_group_items.all(), present),
            }
            for g in rosters[HENCHMEN_GROUP.key]
        ],
        hirelings=[
            {
                "id": s.id,
                "warband_id": s.warband_id,
                "name": s.name,
                "unit_type": s.unit_type,
                "kind": s.kind,
                "rating": s.rating,
                "blood_pacted": s.blood_pacted,
                "missing_games": s.missing_games,
                "xp": s.xp,
                "mount_bonuses": mount_bonuses(s.hireling_items.all()),
                "fee_kind": (s.hire_fee or {}).get("kind"),  # one in a hero's place counts as a hero
            }
            for s in rosters[HIRELING.key]
        ],
    )


def _encampments(warband: Warband) -> list[dict[str, Any]]:
    settings = getattr(warband.campaign, "settings", None)
    return held_by(warband) if settings is not None and settings.enable_encampments else []


def warband_sheet(warband: Warband, capabilities: dict[str, bool]) -> dict[str, Any]:
    # Each kind's roster with its loadout (summary prefetch), then the item details once for all of them.
    rosters: dict[str, list[Any]] = {key: list(kind.roster(warband, detail=False)) for key, kind in KINDS.items()}
    items = [
        link.item
        for key, kind in KINDS.items()
        for unit in rosters[key]
        for link in getattr(unit, kind.items.relation).all()
    ]
    prefetch_related_objects(items, *item_detail_prefetches())

    summary_context = {"warband_units": _summary_units(rosters)}
    return {
        "warband": WarbandSerializer(warband).data,
        "summary": WarbandSummarySerializer(warband, context=summary_context).data,
        "capabilities": capabilities,
        "rules": WarbandRuleSerializer(warband.rules.all(), many=True).data,
        # the plot it follows and its ladder's points, for the campaign point track (apps/plots); null: none
        "plot": warband_plot(warband.plot_id),
        # the list's own name for an item, by fighter key, from its template (the templates plan, question 12)
        "item_names": template_item_names(warband),
        # what it holds while the campaign has Encampments on (one query); [] while they are off
        "encampments": _encampments(warband),
        **{kind.collection: UNIT_SERIALIZERS[key].detail(rosters[key], many=True).data for key, kind in KINDS.items()},
    }


def warband_summaries(warband_ids: list[int]) -> dict[int, Any]:
    """Each warband's summary payload (a completed trade sends both players theirs), the units read once for all."""
    warbands = (
        Warband.objects.select_related("campaign", "campaign__settings")
        .prefetch_related("resources")
        .filter(id__in=warband_ids)
    )
    units = load_warband_units(warband_ids)
    return {
        warband.id: WarbandSummarySerializer(warband, context={"warband_units": units[warband.id]}).data
        for warband in warbands
    }
