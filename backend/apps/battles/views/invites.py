"""Answering a battle invitation: accept (join/), decline (decline/), and what follows (BUG-45, BATL-NEW-05).

Invitees can decline until the battle starts (decision 4). A declined or cancelled participant no longer counts:
with fewer than two players left the battle is cancelled, and once everyone left has accepted, prebattle opens.
A declined invitation can't be taken back by joining.
"""

from django.db import transaction
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.throttling import BATTLE_WRITE_THROTTLE_CLASSES

from ..models import Battle, BattleParticipant
from ..services.broadcast import ALL, bump_state_version
from ..services.invites import decline_invitation
from .responses import broadcast_response, response_with_snapshot
from .shared import _get_user_battle_participant


class CampaignBattleDeclineView(APIView):
    """POST: an invitee declines while the battle is still inviting."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id):
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if participant.status == BattleParticipant.STATUS_DECLINED:
                return response_with_snapshot(battle.id, [])
            if battle.flow_type != Battle.FLOW_TYPE_NORMAL or battle.status != Battle.STATUS_INVITING:
                detail = "Only an invitation can be declined, before the battle starts"
                return Response({"detail": detail, "code": "not_inviting"}, status=400)
            if battle.created_by_user_id == request.user.id:
                detail = "You created this battle; cancel it instead"
                return Response({"detail": detail, "code": "creator_cannot_decline"}, status=400)
            if participant.status not in (BattleParticipant.STATUS_INVITED, BattleParticipant.STATUS_ACCEPTED):
                return Response({"detail": "You are no longer invited", "code": "not_invited"}, status=400)
            events = decline_invitation(battle, participant, actor_user=request.user, reason="declined")
            version = bump_state_version(battle)
        return broadcast_response(request, battle.id, events, version, changed=ALL)
