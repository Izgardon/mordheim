"""Warband rating, unit lists and gold, computed in a fixed number of queries.

Rating and the unit name lists read the same three unit tables, so each table is
queried once for any number of warbands (the campaign roster rates every warband).
"""

from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any

from django.db.models import Case, Count, IntegerField, Q, Sum, Value, When
from django.db.models.functions import Abs, Coalesce, Lower, Trim

from apps.warbands.models import HenchmenGroup, Hero, HiredSword, WarbandTrade

# Ledger actions that spend gold; everything else adds it.
EXPENSE_ACTIONS = {
    "buy",
    "bought",
    "recruit",
    "recruited",
    "hired",
    "hire",
    "upkeep",
    "trade sent",
}


def _as_number(value: Any) -> float | int:
    if value is None:
        return 0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0


@dataclass
class WarbandUnits:
    heroes: list[dict[str, Any]] = field(default_factory=list)
    henchmen_groups: list[dict[str, Any]] = field(default_factory=list)
    hired_swords: list[dict[str, Any]] = field(default_factory=list)

    @property
    def rating(self) -> float | int:
        hero_rating = sum(((20 if row["large"] else 5) + _as_number(row["xp"])) for row in self.heroes)
        henchmen_rating = sum(
            (row["henchmen_count"] or 0) * ((20 if row["large"] else 5) + _as_number(row["xp"]))
            for row in self.henchmen_groups
        )
        hired_rating = sum((_as_number(row["rating"]) + _as_number(row["xp"])) for row in self.hired_swords)
        return hero_rating + henchmen_rating + hired_rating


def load_warband_units(warband_ids: Iterable[int]) -> dict[int, WarbandUnits]:
    """Living units per warband, ordered by id: three queries regardless of warband count."""
    ids = list(warband_ids)
    units = {warband_id: WarbandUnits() for warband_id in ids}
    if not ids:
        return units

    heroes = (
        Hero.objects.filter(warband_id__in=ids, dead=False)
        .order_by("id")
        .values("id", "warband_id", "name", "unit_type", "xp", "large")
    )
    for hero_row in heroes:
        units[hero_row["warband_id"]].heroes.append(dict(hero_row))

    groups = (
        HenchmenGroup.objects.filter(warband_id__in=ids, dead=False)
        .annotate(henchmen_count=Count("henchmen", filter=Q(henchmen__dead=False)))
        .order_by("id")
        .values("id", "warband_id", "name", "unit_type", "xp", "large", "henchmen_count")
    )
    for group_row in groups:
        units[group_row["warband_id"]].henchmen_groups.append(dict(group_row))

    hired_swords = (
        HiredSword.objects.filter(warband_id__in=ids, dead=False)
        .order_by("id")
        .values("id", "warband_id", "name", "unit_type", "rating", "xp")
    )
    for sword_row in hired_swords:
        units[sword_row["warband_id"]].hired_swords.append(dict(sword_row))

    return units


def warband_gold(warband_id: int) -> int:
    """Current gold from the ledger, summed in the database (expenses count negative)."""
    signed_price = Case(
        When(action_key__in=EXPENSE_ACTIONS, then=-Abs("price")),
        default=Abs("price"),
        output_field=IntegerField(),
    )
    totals = (
        WarbandTrade.objects.filter(warband_id=warband_id)
        .annotate(action_key=Lower(Trim("action")))
        .aggregate(gold=Coalesce(Sum(signed_price), Value(0)))
    )
    return int(totals["gold"])
