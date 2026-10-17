"""Spending a level-up, the same for heroes, henchmen groups and hired swords (BUG-62).

The kind decides which advances it may take (`stat_advances`, `placeholder_advances`) and whether its
`no_level_ups` flag applies; everything else is shared.
"""

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any

from django.db import transaction
from django.db.models import F, Func, JSONField, Model, Value
from django.db.models.functions import Least
from django.utils import timezone

from apps.logs.utils import log_warband_event
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell
from apps.warbands.models import RosterUnit, Warband

if TYPE_CHECKING:
    from apps.warbands.units.kinds import UnitKindSpec

# Advances that add a "New Skill" / "New Spell" / "New Special" entry the player resolves later:
# code -> (the kind's link it goes into, the placeholder's name).
PLACEHOLDERS: Mapping[str, tuple[str, str]] = {
    "Skill": ("skills", "New Skill"),
    "Spell": ("spells", "New Spell"),
    "Special": ("specials", "New Special"),
}
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
MAX_STAT = 10


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


def spend_level_up(unit: RosterUnit, *, stat_field: str | None, record: dict[str, Any]) -> bool:
    """Spend one of `unit`'s level-ups in a single UPDATE; False if it has none left.

    The UPDATE only matches while `level_up > 0`, so two requests can't both spend the last one, and it
    raises the stat (to at most 10) and appends `record` to the history in the database, so concurrent
    advances can't overwrite each other either.
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
        changes[stat_field] = Least(F(stat_field) + 1, Value(MAX_STAT))
    return type(unit)._default_manager.filter(pk=unit.pk, level_up__gt=0).update(**changes) == 1


def pending_placeholder(model: type[Skill] | type[Spell] | type[Special], name: str) -> Any:
    """The global placeholder entry (e.g. Skill "New Skill", type "Pending"), created if it is missing."""
    placeholder: Model | None = model.objects.filter(campaign__isnull=True, name=name, type="Pending").first()
    if placeholder is None:
        placeholder = model.objects.create(name=name, type="Pending")
    return placeholder


def valid_advance_id(kind: "UnitKindSpec", payload: Mapping[str, Any]) -> str:
    """The advance code in `payload["advance"]` if the kind may take it; LevelUpRejected otherwise."""
    advance = payload.get("advance", {})
    advance_id = advance.get("id") if isinstance(advance, dict) else None
    if not isinstance(advance_id, str):
        raise LevelUpRejected("Invalid advance")
    if advance_id not in kind.stat_advances and not (kind.placeholder_advances and advance_id in PLACEHOLDERS):
        raise LevelUpRejected("Invalid advance")
    return advance_id


def apply_advance(
    kind: "UnitKindSpec", warband: Warband, unit: RosterUnit, payload: dict[str, Any], *, savepoint: bool = True
) -> None:
    """Spend one of `unit`'s level-ups on `payload["advance"]` and log the payload as sent, in one transaction.

    Raises LevelUpRejected when the unit has none to spend (or the kind's `no_level_ups` flag is set) and when
    the advance isn't one the kind may take.
    """
    if (kind.has_no_level_ups and getattr(unit, "no_level_ups", False)) or (unit.level_up or 0) <= 0:
        raise LevelUpRejected("No level ups available")
    advance_id = valid_advance_id(kind, payload)
    record = advance_record(payload["advance"], STAT_LABELS)
    with transaction.atomic(savepoint=savepoint):  # a caller already in a transaction may skip the savepoint
        if not spend_level_up(unit, stat_field=kind.stat_advances.get(advance_id), record=record):
            raise LevelUpRejected("No level ups available")  # spent by another request meanwhile
        if advance_id in PLACEHOLDERS:
            link_name, placeholder_name = PLACEHOLDERS[advance_id]
            link = getattr(kind, link_name)
            entry = pending_placeholder(link.catalogue, placeholder_name)
            link.model._default_manager.create(**{kind.parent_field: unit, link.target: entry})
        log_warband_event(warband.id, "advance", kind.advance_log_type, payload)
