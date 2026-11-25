"""Missing games: a unit out for a number of the warband's battles (heroes and hired swords), or one member of a
henchmen group (William, 25 Nov 2026: "Henchmen need to be able to miss a game individually not as a group"), who
stays in his group and its size but is out of the rating and left out of prebattle at first; a group misses none.

Edit mode sets and clears them through the unit's update (a member's through his group's member list); a battle the
warband finalises counts one game for each missing unit and member (apps/battles/services/postbattle/missing.py). Both
write the same two log rows: "<name> misses 2 games: <reason>" when a count or reason is set, and "<name> returns" when
the unit is back.
"""

from collections.abc import Mapping
from typing import Any

from django.db.models import QuerySet

from apps.warbands.models import Henchman, HenchmenGroup, on_roster

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


def missing_members(**where: Any) -> QuerySet[Henchman]:
    """The living members of groups on a roster who miss games, filtered by `where` (`group__warband_id=...`)."""
    rows = Henchman.objects.filter(group__dead=False, group__dismissed_at__isnull=True, missing_games__gt=0, **where)
    return on_roster(rows)


def member_name(group: HenchmenGroup, member: Henchman) -> str:
    return member.name or group.unit_type or "Henchman"


def member_missing_logs(
    group: HenchmenGroup, changed: list[Henchman], before: Mapping[Any, tuple[int, str]], sent: dict[int, set[str]]
) -> list[LogEntry]:
    """For members a group save changed: each settled (a dead one misses nothing, one back keeps no reason, and a
    field that settles is written with the rest: `sent`), and the log rows of those whose missing games changed."""
    logs = []
    for member in changed:
        settle_missing(member)
        after = missing_state(member)
        if after == before[member.id]:
            continue
        sent[member.id] |= {"missing_games", "missing_reason"}
        if member.dead:
            continue  # dead, not back
        entry = missing_change_log(member_name(group, member), before[member.id], after)
        if entry is not None:
            logs.append(entry)
    return logs
