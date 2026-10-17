"""Loadout helpers shared by the unit views."""

from typing import Any


def linked_ids(links: Any, column: str) -> set[int]:
    """The catalogue ids one of a unit's join relations links to (e.g. `hero.hero_skills`, "skill_id"), in one query."""
    return {pk for pk in links.values_list(column, flat=True) if pk}
