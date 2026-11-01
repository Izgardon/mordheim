"""Rounds (next step 6): the fight starts in round 1 and moves on when everyone still fighting agrees.

A player asks for the next round (`round/ {action: "ask"}`), which opens `Battle.round_request` ({"round",
"asked_by", "agreed"}); the others agree, and once every player still in the fight has (players who finished their
battle don't count), the round goes up. Anyone in the fight can take the request back (`withdraw`); only the creator
or a battle manager can start it anyway (`force`, William; the view refuses the others and the `force_round`
capability says who may). Each change is a timeline event broadcast like every shared write. The new round's step
happens here, on the server: every knocked down model stands up and every stunned one is knocked down, the players'
units and the neutral creatures alike. Kills and out-of-action events carry the round they happened in.
"""

from ..models import Battle, BattleEvent, BattleParticipant
from ..validation.config import normalize_unit_information
from .errors import Refused
from .events import append_event
from .locks import locked
from .neutrals import stand_up_creatures
from .unit_information import is_empty, stand_up

ACTIONS = ("ask", "agree", "force", "withdraw")
NO_REQUEST = "Nobody has asked for the next round."


def _fighters(battle: Battle) -> list[BattleParticipant]:
    """The players still in the fight, locked (the caller's own row is already)."""
    rows = BattleParticipant.objects.filter(battle_id=battle.id, status=BattleParticipant.STATUS_IN_BATTLE)
    return list(locked(rows.order_by("id")))


def _stand_up(participant: BattleParticipant) -> None:
    unit_information = normalize_unit_information(participant.unit_information_json)
    changed = False
    for key, entry in list(unit_information.items()):
        if stand_up(entry):
            changed = True
            if is_empty(entry):
                unit_information.pop(key)
    if changed:
        participant.unit_information_json = unit_information
        participant.save(update_fields=["unit_information_json", "updated_at"])


def _start_next(battle: Battle, fighters: list[BattleParticipant], actor, *, forced: bool) -> dict:
    battle.round = (battle.round or 1) + 1
    battle.round_request = None
    for participant in fighters:
        _stand_up(participant)
    stand_up_creatures(battle)
    battle.save(update_fields=["round", "round_request", "neutral_groups_json"])
    payload = {"round": battle.round, "forced": forced}
    return append_event(battle, BattleEvent.TYPE_ROUND_STARTED, actor_user=actor, payload=payload)


def _everyone_agreed(request: dict, fighters: list[BattleParticipant]) -> bool:
    agreed = set(request.get("agreed") or [])
    return all(participant.user_id in agreed for participant in fighters)


def change_round(battle: Battle, action: str, actor) -> tuple[list[dict], bool]:
    """Ask, agree, force or withdraw: the events added, and whether a new round started (which changes every
    fighter's units)."""
    target = (battle.round or 1) + 1
    request = battle.round_request if isinstance(battle.round_request, dict) else None
    if request and request.get("round") != target:
        request = None  # left from an older round
    fighters = _fighters(battle)
    if action == "withdraw":
        if request is None:
            return [], False
        battle.round_request = None
        battle.save(update_fields=["round_request"])
        payload = {"round": target}
        return [
            append_event(battle, BattleEvent.TYPE_ROUND_REQUEST_WITHDRAWN, actor_user=actor, payload=payload)
        ], False
    if action == "force":
        return [_start_next(battle, fighters, actor, forced=True)], True
    if request is None and action == "agree":
        raise Refused(NO_REQUEST, code="no_round_request")
    events: list[dict] = []
    if request is None:
        request = {"round": target, "asked_by": actor.id, "agreed": [actor.id]}
        events.append(
            append_event(battle, BattleEvent.TYPE_ROUND_REQUESTED, actor_user=actor, payload={"round": target})
        )
    elif actor.id not in request.get("agreed", []):
        request = {**request, "agreed": [*request.get("agreed", []), actor.id]}
        events.append(append_event(battle, BattleEvent.TYPE_ROUND_AGREED, actor_user=actor, payload={"round": target}))
    else:
        return [], False
    if _everyone_agreed(request, fighters):
        return [*events, _start_next(battle, fighters, actor, forced=False)], True
    battle.round_request = request
    battle.save(update_fields=["round_request"])
    return events, False
