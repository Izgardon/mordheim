"""Undoing a kill or an item use until you finalise (decision 5, BUG-11, BATL-TWEAK-03).

`POST events/:id/void/` marks one of the player's own `unit_kill_recorded` or `item_used` events voided and adds a
`unit_kill_voided` / `item_used_voided` event naming it; the voided event stays in the timeline. A voided kill no
longer counts anywhere, and a voided item use is not used up at finalise or a skip.
"""

from django.db import transaction
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.throttling import BATTLE_WRITE_THROTTLE_CLASSES

from ..models import Battle, BattleEvent, BattleParticipant
from ..services.broadcast import bump_state_version
from ..services.kills import UNDOABLE_TYPES, killer_unit_key
from ..services.unit_information import is_empty
from .shared import (
    _append_battle_event,
    _broadcast_response,
    _get_user_battle_participant,
    _normalize_unit_information,
    _response_with_snapshot,
)

OPEN_STATUSES = (Battle.STATUS_PREBATTLE, Battle.STATUS_ACTIVE, Battle.STATUS_POSTBATTLE)


def _take_back_kill(participant: BattleParticipant, unit_key: str | None) -> None:
    """The killer's live kill_count goes down by one (the kill and its undo are the only things that move it)."""
    unit_information = _normalize_unit_information(participant.unit_information_json)
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
    return _append_battle_event(
        battle,
        UNDOABLE_TYPES[event.type],
        actor_user=actor_user,
        payload={"voided_event_id": event.id, "unit_key": unit_key},
    )


class CampaignBattleEventVoidView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id, event_id):
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            event = BattleEvent.objects.select_for_update().filter(id=event_id, battle_id=battle.id).first()
            if event is None:
                return Response({"detail": "Not found"}, status=404)
            if event.type not in UNDOABLE_TYPES:
                return Response(
                    {"detail": "Only kills and item uses can be undone", "code": "not_undoable"}, status=400
                )
            if event.actor_user_id != request.user.id:
                return Response({"detail": "You can only undo your own", "code": "not_your_event"}, status=403)
            if event.voided_at is not None:
                return _response_with_snapshot(battle.id, [])
            if (
                battle.status not in OPEN_STATUSES
                or participant.status == BattleParticipant.STATUS_CONFIRMED_POSTBATTLE
            ):
                detail = "You can undo only until you finalise postbattle"
                return Response({"detail": detail, "code": "already_finalised"}, status=400)
            events = [void_event(battle, participant, event, actor_user=request.user)]
            version = bump_state_version(battle)
        return _broadcast_response(request, battle.id, events, version, changed=[participant.id])
