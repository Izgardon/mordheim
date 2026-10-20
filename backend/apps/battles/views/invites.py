"""Declining a battle invitation (BUG-45, BATL-NEW-05): invitees can decline until the battle starts (decision 4);
with fewer than two players left the battle is cancelled, and once everyone left has accepted, prebattle opens.
A declined invitation can't be taken back by joining (services/invites.py)."""

from rest_framework.response import Response

from ..models import Battle, BattleParticipant
from ..services.broadcast import ALL
from ..services.invites import decline_invitation
from .base import BattleWriteView, Scope, Written
from .rules import refused, snapshot_when_player


def _still_invited(scope: Scope) -> Response | None:
    battle = scope.battle
    if battle.flow_type != Battle.FLOW_TYPE_NORMAL or battle.status != Battle.STATUS_INVITING:
        return refused("Only an invitation can be declined, before the battle starts", code="not_inviting")
    if scope.is_creator:
        return refused("You created this battle; cancel it instead", code="creator_cannot_decline")
    if scope.player.status not in (BattleParticipant.STATUS_INVITED, BattleParticipant.STATUS_ACCEPTED):
        return refused("You are no longer invited", code="not_invited")
    return None


class CampaignBattleDeclineView(BattleWriteView):
    """POST: an invitee declines while the battle is still inviting."""

    rules = (snapshot_when_player(BattleParticipant.STATUS_DECLINED), _still_invited)

    def act(self, scope: Scope):
        events = decline_invitation(scope.battle, scope.player, actor_user=scope.user, reason="declined")
        return Written(events, changed=ALL)
