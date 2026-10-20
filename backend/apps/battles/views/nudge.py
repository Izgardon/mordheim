"""Nudging a player who is holding up the battle: `POST nudge/` with his `user_id` (BATL-NEW-08)."""

from ..models import BattleParticipant
from ..services.errors import BattleError, field_error
from ..services.nudge import nudge
from ..services.unfinished import BUSY_BATTLE_STATUSES
from .base import BattleWriteView, Scope, Written
from .rules import normal_flow, only, refuse_player


class CampaignBattleNudgeView(BattleWriteView):
    rules = (
        normal_flow("Reported results are answered on the overview"),
        refuse_player(BattleParticipant.LEFT_STATUSES, "You are no longer in this battle", code="not_in_battle"),
        only(BUSY_BATTLE_STATUSES, "Only the players of an open battle can be nudged"),
    )

    def parse(self, request):
        raw = request.data.get("user_id")
        if isinstance(raw, str) and raw.strip().isdigit():
            raw = int(raw)
        if isinstance(raw, bool) or not isinstance(raw, int) or raw <= 0:
            return field_error("user_id", "user_id is required", "Pick the player to nudge.").response()
        return raw

    def act(self, scope: Scope):
        try:
            event = nudge(scope.battle, scope.player, self.input, scope.user)
        except BattleError as refusal:
            return refusal.response()
        return Written([event], status=201)
