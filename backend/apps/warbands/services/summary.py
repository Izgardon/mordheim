"""Warband rating, unit lists and gold, read in a fixed number of queries.

Rating and the unit name lists read the same three unit tables, so each table is
queried once for any number of warbands (the campaign roster rates every warband).
A unit's switched-on mounts come with its row (`mount_bonuses`): each rider adds his
first mount's rating bonus (units/companions.py).
"""

from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any

from django.db.models import Count, Q

from apps.warbands.models import (
    HenchmenGroup,
    HenchmenGroupItem,
    Hero,
    HeroItem,
    Hireling,
    HirelingItem,
    Warband,
    on_roster,
)
from apps.warbands.units.companions import mount_bonuses_array, mount_rating_bonus

# A group's members on the roster (on_roster, through the group).
LIVING_MEMBERS = Q(henchmen__dead=False, henchmen__dismissed_at__isnull=True)


def _as_number(value: Any) -> float | int:
    if value is None:
        return 0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0


def rated(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The rows the rating counts: units that aren't missing games."""
    return [row for row in rows if not row.get("missing_games")]


@dataclass
class WarbandUnits:
    heroes: list[dict[str, Any]] = field(default_factory=list)
    henchmen_groups: list[dict[str, Any]] = field(default_factory=list)
    hirelings: list[dict[str, Any]] = field(default_factory=list)

    @property
    def mounts_rating(self) -> int:
        """What the mounts add to the rating: each rider's first mount's bonus (a group rides one per living member,
        each counted at its own bonus, so a group on mixed mounts adds each one's). Missing riders don't count."""
        riders = [(row, 1) for row in rated([*self.heroes, *self.hirelings])]
        riders += [(row, row["henchmen_count"] or 0) for row in rated(self.henchmen_groups)]
        return sum(mount_rating_bonus(row.get("mount_bonuses"), count) for row, count in riders)

    @property
    def rating(self) -> float | int:
        """5 a model (20 a large one) and its XP, a hired sword's rating and XP, and the mounts' bonuses; units missing
        games are left out (they still count towards warband size and the caps)."""
        hero_rating = sum(((20 if row["large"] else 5) + _as_number(row["xp"])) for row in rated(self.heroes))
        henchmen_rating = sum(
            (row["henchmen_count"] or 0) * ((20 if row["large"] else 5) + _as_number(row["xp"]))
            for row in rated(self.henchmen_groups)
        )
        hired_rating = sum((_as_number(row["rating"]) + _as_number(row["xp"])) for row in rated(self.hirelings))
        return hero_rating + henchmen_rating + hired_rating + self.mounts_rating

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
        .annotate(mount_bonuses=mount_bonuses_array(HeroItem, "hero"))
        .order_by("id")
        .values("id", "warband_id", "name", "unit_type", "xp", "large", "missing_games", "mount_bonuses")
    )
    for hero_row in heroes:
        units[hero_row["warband_id"]].heroes.append(dict(hero_row))

    groups = (
        on_roster(HenchmenGroup.objects.filter(warband_id__in=ids))
        .annotate(henchmen_count=Count("henchmen", filter=LIVING_MEMBERS))
        .annotate(mount_bonuses=mount_bonuses_array(HenchmenGroupItem, "henchmen_group"))
        .order_by("id")
        .values(
            "id", "warband_id", "name", "unit_type", "xp", "large", "henchmen_count", "missing_games", "mount_bonuses"
        )
    )
    for group_row in groups:
        units[group_row["warband_id"]].henchmen_groups.append(dict(group_row))

    hirelings = (
        on_roster(Hireling.objects.filter(warband_id__in=ids))
        .annotate(mount_bonuses=mount_bonuses_array(HirelingItem, "hireling"))
        .order_by("id")
        .values(
            "id",
            "warband_id",
            "name",
            "unit_type",
            "kind",
            "rating",
            "xp",
            "blood_pacted",
            "missing_games",
            "mount_bonuses",
        )
    )
    for sword_row in hirelings:
        units[sword_row["warband_id"]].hirelings.append(dict(sword_row))

    return units


def warband_gold(warband_id: int) -> int:
    """The warband's stored gold, the sum of its ledger (services/ledger.py keeps it); 0 for an unknown warband."""
    return int(Warband.objects.filter(id=warband_id).values_list("gold", flat=True).first() or 0)
