"""Who may take a list line (the templates plan, question 14): `who` narrows a shared list's line by fighter key, and
anyone else sees it dimmed with the reason ("Gaolers only") and can still pick it."""

from collections.abc import Mapping
from typing import Any

from ..models import HERO, TemplateFighter


def allows(who: Mapping[str, Any], fighter: TemplateFighter) -> bool:
    """Whether the line is meant for the fighter: everyone (`{}`), heroes, the fighters named, or all but some."""
    if not who:
        return True
    if "except" in who:
        return fighter.key not in (who.get("except") or [])
    return (bool(who.get("heroes")) and fighter.kind == HERO) or fighter.key in (who.get("fighters") or [])


def _names(keys: list[str], fighters: Mapping[str, TemplateFighter], *, plural: bool) -> list[str]:
    found = [fighters.get(key) for key in keys]
    return [(row.plural or row.name) if plural else row.name for row in found if row is not None] or list(keys)


def who_text(who: Mapping[str, Any], fighters: Mapping[str, TemplateFighter]) -> str:
    """The reason a dimmed line shows: "Heroes only", "Gaolers only", "Heroes and Corsairs only", "Not Questing
    Knight"; blank for a line open to everyone."""
    if not who:
        return ""
    if "except" in who:
        return "Not " + ", ".join(_names(list(who.get("except") or []), fighters, plural=False))
    named = (["Heroes"] if who.get("heroes") else []) + _names(list(who.get("fighters") or []), fighters, plural=True)
    if not named:
        return ""
    listed = named[0] if len(named) == 1 else ", ".join(named[:-1]) + " and " + named[-1]
    return f"{listed} only"
