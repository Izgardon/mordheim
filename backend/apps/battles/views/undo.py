"""Undoing your own kill or item use until you finalise: `POST events/:id/void/` (decision 5, BUG-11)."""

from ..models import Battle, BattleEvent, BattleParticipant
from ..services.errors import Refused
from ..services.kills import UNDOABLE_TYPES
from ..services.locks import locked
from ..services.undo import void_event
from .base import BattleWriteView, Scope, Unchanged, Written, not_found

OPEN_STATUSES = (Battle.STATUS_PREBATTLE, Battle.STATUS_ACTIVE, Battle.STATUS_POSTBATTLE)


class CampaignBattleEventVoidView(BattleWriteView):
    def act(self, scope: Scope):
        event_id = self.kwargs["event_id"]
        event = locked(BattleEvent.objects.filter(id=event_id, battle_id=scope.battle.id)).first()
        if event is None:
            raise not_found()
        if event.type not in UNDOABLE_TYPES:
            raise Refused("Only kills and item uses can be undone", code="not_undoable")
        if event.actor_user_id != scope.user.id:
            raise Refused("You can only undo your own", code="not_your_event", status=403)
        if event.voided_at is not None:
            return Unchanged()
        finalised = scope.player.status == BattleParticipant.STATUS_CONFIRMED_POSTBATTLE
        if scope.battle.status not in OPEN_STATUSES or finalised:
            raise Refused("You can undo only until you finalise postbattle", code="already_finalised")
        events = [void_event(scope.battle, scope.player, event, actor_user=scope.user)]
        return Written(events, changed=[scope.player.id])
