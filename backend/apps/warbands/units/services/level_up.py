"""Spending a level-up, the same for heroes, henchmen groups and hired swords (BUG-62).

The kind decides which advances it may take (`stat_advances`, `pick_advances`) and whether its `no_level_ups` flag
applies; everything else is shared. A Skill, Spell or Special advance leaves a pick to make later from the unit's card:
it raises the unit's `pending_skills` (`pending_spells`, `pending_specials`), and the pick lowers it again.
"""

from collections.abc import Callable, Mapping
from typing import TYPE_CHECKING, Any

from django.db import transaction
from django.db.models import Case, F, Func, JSONField, Value, When
from django.db.models.functions import Least
from django.utils import timezone

from apps.logs.utils import log_warband_event
from apps.warbands.models import MAX_PENDING_PICKS, RosterUnit, Warband
from apps.warbands.utils.stats import MAX_STAT

if TYPE_CHECKING:
    from apps.warbands.units.kinds import UnitKindSpec

# Advances that leave a pick to make later: code -> the unit's count of them (models/shared.py: PendingPicks).
PICKS: Mapping[str, str] = {"Skill": "pending_skills", "Spell": "pending_spells", "Special": "pending_specials"}
# The history label for an advance the client sent without one.
STAT_LABELS: Mapping[str, str] = {
    "M": "Movement",
    "WS": "Weapon Skill",
    "BS": "Ballistic Skill",
    "S": "Strength",
    "T": "Toughness",
    "W": "Wound",
    "I": "Initiative",
    "A": "Attack",
    "Ld": "Leadership",
    "Skill": "Skill",
    "Spell": "Spell",
    "Special": "Special",
}


class LevelUpRejected(Exception):
    """The level-up can't be spent; `detail` is the 400 body's message."""

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


def advance_record(advance: Mapping[str, Any], labels: Mapping[str, str]) -> dict[str, Any]:
    """The level_up_history entry for an advance: its code, the client's label (or the default one) and the time."""
    code = advance["id"]
    label = advance.get("label")
    if not isinstance(label, str) or not label.strip():
        label = labels.get(code, code)
    return {"code": code, "label": label, "timestamp": timezone.now().isoformat()}


def spend_level_up(
    unit: RosterUnit, *, stat_field: str | None, record: dict[str, Any], pick_field: str | None = None
) -> bool:
    """Spend one of `unit`'s level-ups in a single UPDATE; False if it has none left.

    The UPDATE only matches while `level_up > 0`, so two requests can't both spend the last one, and it
    raises the stat (to at most 10), or adds the pick to make later (`pick_field`, up to MAX_PENDING_PICKS), and
    appends `record` to the history in the database, so concurrent advances can't overwrite each other either.
    """
    changes: dict[str, Any] = {
        "level_up": F("level_up") - 1,
        "level_up_history": Func(
            F("level_up_history"),
            Value([record], output_field=JSONField()),
            function="",
            arg_joiner=" || ",
            output_field=JSONField(),
        ),
    }
    if stat_field:
        # a written stat without a number ("D6", "-") stays without one: LEAST would read NULL + 1 as 10
        changes[stat_field] = Case(
            When(**{f"{stat_field}__isnull": True}, then=Value(None)),
            default=Least(F(stat_field) + 1, Value(MAX_STAT)),
        )
    if pick_field:
        changes[pick_field] = Least(F(pick_field) + 1, Value(MAX_PENDING_PICKS))
    return type(unit)._default_manager.filter(pk=unit.pk, level_up__gt=0).update(**changes) == 1


def valid_advance_id(kind: "UnitKindSpec", payload: Mapping[str, Any]) -> str:
    """The advance code in `payload["advance"]` if the kind may take it; LevelUpRejected otherwise."""
    advance = payload.get("advance", {})
    advance_id = advance.get("id") if isinstance(advance, dict) else None
    if not isinstance(advance_id, str):
        raise LevelUpRejected("Invalid advance")
    if advance_id not in kind.stat_advances and not (kind.pick_advances and advance_id in PICKS):
        raise LevelUpRejected("Invalid advance")
    return advance_id


def apply_advance(
    kind: "UnitKindSpec",
    warband: Warband,
    unit: RosterUnit,
    payload: dict[str, Any],
    *,
    savepoint: bool = True,
    pick: Callable[[], dict[str, Any]] | None = None,
) -> None:
    """Spend one of `unit`'s level-ups on `payload["advance"]` and log the payload as sent, in one transaction.

    A Skill, Spell or Special advance raises the pick to make later, unless `pick` makes it now (advance_picks.py):
    it runs after the spend, in the same transaction, and what it returns is logged with the payload as `pick`.
    Raises LevelUpRejected when the unit has none to spend (or the kind's `no_level_ups` flag is set) and when
    the advance isn't one the kind may take.
    """
    if (kind.has_no_level_ups and getattr(unit, "no_level_ups", False)) or (unit.level_up or 0) <= 0:
        raise LevelUpRejected("No level ups available")
    advance_id = valid_advance_id(kind, payload)
    record = advance_record(payload["advance"], STAT_LABELS)
    with transaction.atomic(savepoint=savepoint):  # a caller already in a transaction may skip the savepoint
        stat_field, pick_field = kind.stat_advances.get(advance_id), None if pick else PICKS.get(advance_id)
        if not spend_level_up(unit, stat_field=stat_field, record=record, pick_field=pick_field):
            raise LevelUpRejected("No level ups available")  # spent by another request meanwhile
        logged = {**payload, "pick": pick()} if pick else payload
        log_warband_event(warband.id, "advance", kind.advance_log_type, logged)
