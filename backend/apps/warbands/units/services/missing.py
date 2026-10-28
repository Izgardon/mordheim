"""Missing games: a unit out for a number of the warband's battles (heroes, hired swords, henchmen groups alike).

Edit mode sets and clears them through the unit's update; a battle the warband finalises counts one game for each
missing unit (apps/battles/services/postbattle/missing.py). Both write the same two log rows: "<name> misses 2 games:
<reason>" when a count or reason is set, and "<name> returns" when the unit is back.
"""

from typing import Any

MAX_MISSING_GAMES = 99
MISSING_LOG, RETURNS_LOG = "unit_missing", "unit_returns"  # personnel log entry types

LogEntry = tuple[str, str, dict[str, Any]]  # (feature, entry type, payload)


def missing_log(name: str, games: int, reason: str) -> LogEntry:
    return ("personnel", MISSING_LOG, {"name": name, "games": games, "reason": reason})


def returns_log(name: str) -> LogEntry:
    return ("personnel", RETURNS_LOG, {"name": name})


def missing_state(unit: Any) -> tuple[int, str]:
    return int(unit.missing_games or 0), unit.missing_reason or ""


def settle_missing(unit: Any) -> None:
    """Before a save: a dead unit is missing no more, and a unit that is back keeps no reason."""
    if unit.dead:
        unit.missing_games = 0
    if not unit.missing_games:
        unit.missing_reason = ""


def missing_change_log(name: str, before: tuple[int, str], after: tuple[int, str]) -> LogEntry | None:
    """The log row an edit from `before` to `after` (games, reason) writes, or None when nothing changed."""
    if before == after:
        return None
    games, reason = after
    if games:
        return missing_log(name, games, reason)
    return returns_log(name) if before[0] else None
