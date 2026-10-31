"""Undoing a kill or an item use until you finalise (decision 5, BUG-11, BATL-TWEAK-03).

The player's own `unit_kill_recorded` or `item_used` event is marked voided and a `unit_kill_voided` /
`item_used_voided` event names it; the voided event stays in the timeline. A kill's battle_kill row is voided with it
(next step 9) and no longer counts anywhere; a voided item use is not used up at finalise or a skip.
"""

from django.utils import timezone

from ..models import Battle, BattleEvent, BattleKill, BattleParticipant
from .combat import put_back_victim
from .events import append_event
from .kills import UNDOABLE_TYPES


def _void_kill(battle: Battle, event: BattleEvent) -> tuple[str | None, list[int]]:
    """The kill's row voided with its event: the killer's unit key, and the participants changed when the kill had
    taken its victim out of action (services/combat.py puts him back)."""
    kill = BattleKill.objects.filter(event_id=event.id).first()  # its event's lock keeps undo one at a time
    if kill is None:  # a kill nobody's own unit scored, from before battle_kill: only its event is voided
        killer = (event.payload_json or {}).get("killer")
        return (killer.get("unit_key") if isinstance(killer, dict) else None), []
    kill.voided_at = event.voided_at
    kill.save(update_fields=["voided_at"])
    return kill.killer_unit_key, put_back_victim(battle, kill)


def void_event(
    battle: Battle, participant: BattleParticipant, event: BattleEvent, *, actor_user
) -> tuple[dict, list[int]]:
    """Void the event; a kill's row is voided too, and its victim, if the kill took him out of action, is put back.
    The undo event, and the other participants it changed (the killer's own row is always among the changed: his
    live kill counts move)."""
    event.voided_at = timezone.now()
    event.save(update_fields=["voided_at"])
    others: list[int] = []
    if event.type == BattleEvent.TYPE_UNIT_KILL_RECORDED:
        unit_key, others = _void_kill(battle, event)
        participant.save(update_fields=["updated_at"])  # his kills changed: the player's activity
    else:
        unit_key = (event.payload_json or {}).get("unit_key")
    payload = {"voided_event_id": event.id, "unit_key": unit_key}
    undo = append_event(battle, UNDOABLE_TYPES[event.type], actor_user=actor_user, payload=payload)
    return undo, [row for row in others if row != participant.id]
