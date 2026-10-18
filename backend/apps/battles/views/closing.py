"""Skipping postbattle and closing it for everyone (decision 3, BUG-09, BATL-TWEAK-02).

A skipped player's results aren't applied, but the single-use items he used are used up (BUG-72). Close postbattle
skips everyone who hasn't finished and ends the battle, which records the wins and losses; it is the way out of a
postbattle, since cancelling refuses one.
"""

from django.db import transaction
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.permissions import get_membership, has_campaign_permission
from apps.core.throttling import BATTLE_WRITE_THROTTLE_CLASSES

from ..models import Battle
from ..services.broadcast import ALL, bump_state_version
from ..services.closing import close_postbattle
from .responses import broadcast_response, response_with_snapshot


class CampaignBattleClosePostbattleView(APIView):
    """POST: the battle's creator, or anyone with manage_battles, closes postbattle for everyone."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        with transaction.atomic():
            battle = Battle.objects.select_for_update().filter(id=battle_id, campaign_id=campaign_id).first()
            if not battle:
                return Response({"detail": "Not found"}, status=404)
            if battle.created_by_user_id != request.user.id and not has_campaign_permission(
                membership, "manage_battles"
            ):
                detail = "Only the battle's creator or a battle manager can close postbattle"
                return Response({"detail": detail, "code": "not_allowed"}, status=403)
            if battle.status == Battle.STATUS_ENDED:
                return response_with_snapshot(battle.id, [])
            if battle.status != Battle.STATUS_POSTBATTLE:
                return Response({"detail": "Battle is not in postbattle"}, status=400)
            events = close_postbattle(battle, actor_user=request.user, mode="closed")
            version = bump_state_version(battle)
        return broadcast_response(request, battle.id, events, version, changed=ALL)
