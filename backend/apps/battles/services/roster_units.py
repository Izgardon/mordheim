"""Reading units out of a participant's battle roster (`roster_json`, the snapshot `start/` keeps; services/rosters.py
builds it)."""

from collections.abc import Iterator
from typing import Any


def roster_units(roster: dict[str, Any] | None) -> Iterator[dict[str, Any]]:
    """Every unit entry of a battle roster: its heroes, its hired swords and each henchmen group's members."""
    roster = roster or {}
    yield from roster.get("heroes", [])
    yield from roster.get("hirelings", [])
    for group in roster.get("henchmenGroups", []):
        yield from group.get("members", [])


def roster_entry(roster: dict[str, Any] | None, unit_key: str) -> dict[str, Any] | None:
    """The roster's entry for a unit key, or None."""
    return next((entry for entry in roster_units(roster) if entry.get("key") == unit_key), None)
