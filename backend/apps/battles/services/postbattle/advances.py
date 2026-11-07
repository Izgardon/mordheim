"""The advances a player rolled in the Aftermath, applied at finalise once the battle's XP has awarded the level-ups
(next step 3).

Each is spent through the shared level-up service (`apply_advance`: the kind's advances, one level-up each, logged as
an advance), so the warband ends up as if the player had taken them on the card. A henchmen group's advances ride
on its members' results; the first member's are the group's. The lad's got talent is left unspent, to be resolved
from the group's card (the promotion picks a member and his hero advance). An advance the unit can't take (no
level-up left, a dead unit, one gone since) is skipped with a warning: a guide, not a gatekeeper.
"""

from typing import Any

from apps.warbands.models import RosterUnit
from apps.warbands.units.kinds import HENCHMEN_GROUP, HERO, HIRELING, UnitKindSpec
from apps.warbands.units.services.level_up import LevelUpRejected, apply_advance

from ...validation.unit_keys import parse_unit_key
from ..warnings import Warning
from .context import FinaliseContext

ADVANCE_SKIPPED = "advance_skipped"
LADS_GOT_TALENT = "LGT"


def _skipped(name: str, label: str, reason: str) -> Warning:
    return {"code": ADVANCE_SKIPPED, "message": f"{name}'s advance ({label}) wasn't taken: {reason}."}


def _unit(context: FinaliseContext, unit_key: str) -> tuple[UnitKindSpec, RosterUnit | None, str]:
    """The kind and live row an advance goes to (a henchman's group), and the name the payload logs under."""
    parsed = parse_unit_key(unit_key)
    unit_id = parsed["unit_id"]
    if parsed["unit_type"] == "hero":
        return HERO, context.hero(unit_id), "hero"
    if parsed["unit_type"] == "hireling":
        hireling = context.hirelings.get(unit_id)
        return HIRELING, hireling if hireling and hireling.dismissed_at is None else None, "hero"
    member = next((member for member in context.henchmen if member.id == unit_id), None)
    return HENCHMEN_GROUP, context.groups.get(member.group_id) if member else None, "group"


def _payload(name_key: str, name: str, advance: dict[str, Any]) -> dict[str, Any]:
    """The level-up payload the card sends: the unit, the advance and the dice."""
    payload: dict[str, Any] = {name_key: name, "advance": {"id": advance["id"], "label": advance["label"]}}
    rolls = advance.get("rolls") or []
    if len(rolls) >= 2:
        payload["roll1"] = {"dice": "2D6", "result": {"total": rolls[0] + rolls[1]}}
    if len(rolls) == 3:
        payload["roll2"] = {"dice": "D6", "result": {"total": rolls[2]}}
    return payload


def apply_advances(context: FinaliseContext, unit_results: dict[str, dict]) -> list[Warning]:
    """Spend each unit's Aftermath advances (after its XP was applied); the warnings for those skipped."""
    warnings: list[Warning] = []
    done_groups: set[int] = set()
    for unit_key, raw in unit_results.items():
        advances = [advance for advance in raw.get("advances", []) if advance["id"] != LADS_GOT_TALENT]
        if not advances:
            continue
        kind, unit, name_key = _unit(context, unit_key)
        name = raw.get("unit_name") or unit_key
        if kind is HENCHMEN_GROUP and unit is not None:
            if unit.pk in done_groups:
                continue
            done_groups.add(unit.pk)
            name = raw.get("group_name") or name
        for advance in advances:
            label = advance["label"] or advance["id"]
            if unit is None or unit.dead:
                warnings.append(_skipped(name, label, "the unit is no longer on the roster"))
                continue
            try:
                apply_advance(kind, context.warband, unit, _payload(name_key, name, advance))  # own savepoint
            except LevelUpRejected as rejected:
                warnings.append(_skipped(name, label, rejected.detail.lower()))
    return warnings
