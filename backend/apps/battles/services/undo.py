"""Undoing a kill or an item use until you finalise (decision 5, BUG-11, BATL-TWEAK-03).

The player's own `unit_kill_recorded` or `item_used` event is marked voided and a `unit_kill_voided` /
`item_used_voided` event names it; the voided event stays in the timeline. A voided kill no longer counts anywhere,
and a voided item use is not used up at finalise or a skip.
"""

from django.utils import timezone

from ..models import Battle, BattleEvent, BattleParticipant
from ..validation.config import normalize_unit_information
from .events import append_event
from .kills import UNDOABLE_TYPES, killer_unit_key
from .unit_information import is_empty


def _take_back_kill(participant: BattleParticipant, unit_key: str | None) -> None:
    """The killer's live kill_count goes down by one (the kill and its undo are the only things that move it)."""
    unit_information = normalize_unit_information(participant.unit_information_json)
    entry = unit_information.get(unit_key or "")
    if entry is None:
        return
    entry["kill_count"] = max(0, entry["kill_count"] - 1)
    if is_empty(entry):
        unit_information.pop(unit_key or "")
    participant.unit_information_json = unit_information
    participant.save(update_fields=["unit_information_json", "updated_at"])


def void_event(battle: Battle, participant: BattleParticipant, event: BattleEvent, *, actor_user) -> dict:
    event.voided_at = timezone.now()
    event.save(update_fields=["voided_at"])
    unit_key = killer_unit_key(event) if event.type == BattleEvent.TYPE_UNIT_KILL_RECORDED else None
    if event.type == BattleEvent.TYPE_UNIT_KILL_RECORDED:
        _take_back_kill(participant, unit_key)
    else:
        unit_key = (event.payload_json or {}).get("unit_key")
    payload = {"voided_event_id": event.id, "unit_key": unit_key}
    return append_event(battle, UNDOABLE_TYPES[event.type], actor_user=actor_user, payload=payload)
