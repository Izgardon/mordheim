"""What the catalogue seeders share (BUG-54; IMP-81 gathers the rest of their helpers here in PR B)."""

from collections.abc import Mapping
from typing import Any

from django.core.management.base import CommandError

STAT_FIELDS = (
    "movement",
    "weapon_skill",
    "ballistic_skill",
    "strength",
    "toughness",
    "wounds",
    "initiative",
    "attacks",
    "leadership",
)


def read_stats(values: Mapping[str, Any], label: str) -> dict[str, int]:
    """A seeded profile's nine characteristics as whole numbers. A missing or blank stat, or one that isn't a whole
    number, stops the seeder with an error naming the profile and the stat (BUG-54: fail loudly, never a 0 or a crash
    on save); the seeder's transaction keeps nothing it wrote."""
    stats: dict[str, int] = {}
    problems: list[str] = []
    for field in STAT_FIELDS:
        value = values.get(field)
        text = "" if value is None else str(value).strip()
        if not text.lstrip("-").isdigit():
            problems.append(f"{field} {'is missing' if not text else f'is {value!r}'}")
            continue
        stats[field] = int(text)
    if problems:
        raise CommandError(f"{label}: {', '.join(problems)}.")
    return stats
