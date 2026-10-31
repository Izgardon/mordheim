"""A unit that dies loses what he carries (pass 2 decision 7, BATL-TWEAK-08).

A dead hero or hired sword keeps his items on his record, out of the warband's reach (dead units are off the
roster). A henchman carries his share of his group's loadout (henchmen loadouts): nothing is deleted, the loadout
follows the living members, and the battle log lists what he carried (each row he had no gap on).
"""

from typing import Any

from apps.warbands.models import Henchman
from apps.warbands.services.loadouts import carried_rows


def henchman_share(member: Henchman) -> list[str]:
    """The items a member who died carried: one of each loadout row he had no gap on (one query)."""
    return [row.item.name for row in carried_rows(member)]


def lost_entry(unit_name: str, items: list[str]) -> dict[str, Any] | None:
    return {"unit_name": unit_name, "items": items} if items else None
