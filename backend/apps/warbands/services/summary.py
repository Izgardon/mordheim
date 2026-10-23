"""Warband rating, unit lists and gold, read in a fixed number of queries.

Rating and the unit name lists read the same three unit tables, so each table is
queried once for any number of warbands (the campaign roster rates every warband).
"""

from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any

from django.db.models import Count, Q

from apps.warbands.models import HenchmenGroup, Hero, Hireling, Warband, on_roster

# A group's members on the roster (on_roster, through the group).
LIVING_MEMBERS = Q(henchmen__dead=False, henchmen__dismissed_at__isnull=True)


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
    hirelings: list[dict[str, Any]] = field(default_factory=list)

    @property
    def rating(self) -> float | int:
        hero_rating = sum(((20 if row["large"] else 5) + _as_number(row["xp"])) for row in self.heroes)
        henchmen_rating = sum(
            (row["henchmen_count"] or 0) * ((20 if row["large"] else 5) + _as_number(row["xp"]))
            for row in self.henchmen_groups
        )
        hired_rating = sum((_as_number(row["rating"]) + _as_number(row["xp"])) for row in self.hirelings)
        return hero_rating + henchmen_rating + hired_rating

    @property
    def hero_count(self) -> int:
        """Heroes towards the hero cap: every hero on the roster."""
        return len(self.heroes)

    @property
    def hireling_count(self) -> int:
        """Hired swords towards the hired-sword cap: blood-pacted ones don't count (decision 12), nor do dramatis
        personae, which sit outside it (their rating counts like a hired sword's)."""
        return sum(1 for row in self.hirelings if not row["blood_pacted"] and row["kind"] == "hired_sword")

    @property
    def unit_count(self) -> int:
        """Warband size (max_units): heroes, living henchmen and blood-pacted hired swords only (decision 12)."""
        henchmen = sum(row["henchmen_count"] or 0 for row in self.henchmen_groups)
        return self.hero_count + henchmen + sum(1 for row in self.hirelings if row["blood_pacted"])


def load_warband_units(warband_ids: Iterable[int]) -> dict[int, WarbandUnits]:
    """Each warband's roster units (alive, not dismissed) in id order: three queries for any number of warbands."""
    ids = list(warband_ids)
    units = {warband_id: WarbandUnits() for warband_id in ids}
    if not ids:
        return units

    heroes = (
        on_roster(Hero.objects.filter(warband_id__in=ids))
        .order_by("id")
        .values("id", "warband_id", "name", "unit_type", "xp", "large")
    )
    for hero_row in heroes:
        units[hero_row["warband_id"]].heroes.append(dict(hero_row))

    groups = (
        on_roster(HenchmenGroup.objects.filter(warband_id__in=ids))
        .annotate(henchmen_count=Count("henchmen", filter=LIVING_MEMBERS))
        .order_by("id")
        .values("id", "warband_id", "name", "unit_type", "xp", "large", "henchmen_count")
    )
    for group_row in groups:
        units[group_row["warband_id"]].henchmen_groups.append(dict(group_row))

    hirelings = (
        on_roster(Hireling.objects.filter(warband_id__in=ids))
        .order_by("id")
        .values("id", "warband_id", "name", "unit_type", "kind", "rating", "xp", "blood_pacted")
    )
    for sword_row in hirelings:
        units[sword_row["warband_id"]].hirelings.append(dict(sword_row))

    return units


def warband_gold(warband_id: int) -> int:
    """The warband's stored gold, the sum of its ledger (services/ledger.py keeps it); 0 for an unknown warband."""
    return int(Warband.objects.filter(id=warband_id).values_list("gold", flat=True).first() or 0)
