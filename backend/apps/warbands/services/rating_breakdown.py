"""The warband rating unit by unit, for the header's Rating and Units windows (William, 22 Nov 2026: "rating ...
units (list of all unit names sectioned by their type with their level) ... should be clickable").

Each row is what one unit adds to the summary's `rating` (`summary.WarbandUnits.rating`, the same rule): its models
times 5 a model (20 a large one) or a hired sword's own rating, plus its XP per model, plus its mounts' bonuses; a unit
missing games adds nothing and says so. Its level is how many of its kind's XP thresholds its XP has reached. Read from
the units the summary already loaded, so it costs no query.
"""

from typing import Any, cast

from apps.campaigns.models import CampaignSettings
from apps.warbands.units.companions import mount_rating_bonus
from apps.warbands.units.kinds import KINDS, UnitKindKey

from .summary import WarbandUnits
from .summary import _as_number as as_number


def _level(kind: str, xp: Any, settings: CampaignSettings | None) -> int:
    spec = KINDS[cast(UnitKindKey, kind)]
    thresholds = getattr(settings, spec.thresholds_setting) if settings else None
    return spec.count_level_ups(0, xp, thresholds)


def _row(
    kind: str, section: str, row: dict[str, Any], models: int, per_model: float, mounts: int, settings: Any
) -> dict[str, Any]:
    missing = bool(row.get("missing_games"))
    xp = as_number(row["xp"])
    return {
        "kind": section,  # hero, henchmen_group, hired_sword or dramatis_persona: the Units window's sections
        "id": row["id"],
        "name": row["name"] or row["unit_type"] or "",
        "unit_type": row["unit_type"] or "",
        "models": models,
        "per_model": per_model,
        "xp": xp,
        "mounts": mounts,
        "total": 0 if missing else models * (per_model + xp) + mounts,
        "missing": missing,  # missing games: left out of the rating, still on the roster
        "level": _level(kind, row["xp"], settings),
    }


def rating_breakdown(units: WarbandUnits, settings: CampaignSettings | None) -> list[dict[str, Any]]:
    """Each roster unit's part of the rating, heroes first, then the henchmen groups and the hired swords."""
    heroes = [
        _row(
            "hero", "hero", row, 1, 20 if row["large"] else 5, mount_rating_bonus(row.get("mount_bonuses"), 1), settings
        )
        for row in units.heroes
    ]
    groups = [
        _row(
            "henchmen_group",
            "henchmen_group",
            row,
            row["henchmen_count"] or 0,
            20 if row["large"] else 5,
            int(row.get("mount_rating") or 0),
            settings,
        )
        for row in units.henchmen_groups
    ]
    swords = [
        _row(
            "hireling",
            row["kind"],
            row,
            1,
            as_number(row["rating"]),
            mount_rating_bonus(row.get("mount_bonuses"), 1),
            settings,
        )
        for row in units.hirelings
    ]
    return heroes + groups + swords
