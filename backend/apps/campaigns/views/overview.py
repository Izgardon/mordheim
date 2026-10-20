"""The campaign overview's reads (players, battle history, pivotal moments, top killers) and Settings > Active
Battles (the open battles, and cancelling one) for battle managers."""

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.battles.services.broadcast import ALL
from apps.battles.views.responses import broadcast_response, response_with_snapshot
from apps.core.throttling import BATTLE_WRITE_THROTTLE_CLASSES
from apps.users.names import display_name

from ..constants import OWNER
from ..selectors import (
    battle_history_payload,
    campaign_memberships,
    format_short_date,
    pivotal_moments,
    players_payload,
    top_killers_payload,
)
from ..serializers.history import CampaignTopKillerSerializer, PivotalMomentSerializer
from ..serializers.members import CampaignPlayerSerializer
from ..services import active_battles
from .base import CampaignScopedView


class CampaignPlayersView(APIView):
    """GET: every member with his warband and battle state; `?fields=basic` gives ids and names for pickers.

    Not a CampaignScopedView: the member check reads the list it returns, one query fewer (PERF-41)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        memberships = campaign_memberships(campaign_id)
        if all(member.user_id != request.user.id for member in memberships):  # the member check (PERF-41)
            return Response({"detail": "Not found"}, status=404)
        if request.query_params.get("fields") == "basic":  # name pickers need no warbands (PERF-41)
            return Response([{"id": member.user_id, "name": display_name(member.user)} for member in memberships])
        return Response(CampaignPlayerSerializer(players_payload(campaign_id, memberships), many=True).data)


class CampaignBattleHistoryView(CampaignScopedView):
    def get(self, request, campaign_id):
        return Response(battle_history_payload(campaign_id))


class CampaignPivotalMomentsView(CampaignScopedView):
    def get(self, request, campaign_id):
        moments = pivotal_moments(campaign_id)
        rows = PivotalMomentSerializer(moments, many=True).data
        dates = (format_short_date(moment.battle_ended_at) for moment in moments)
        return Response([{**row, "date": date} for row, date in zip(rows, dates, strict=True)])


class CampaignTopKillersView(CampaignScopedView):
    def get(self, request, campaign_id):
        return Response({"top_killers": CampaignTopKillerSerializer(top_killers_payload(campaign_id), many=True).data})


class CampaignActiveBattlesView(CampaignScopedView):
    """GET: the open battles, with the manager tools that apply to each (manage_battles)."""

    rules = {"GET": "manage_battles"}

    def get(self, request, campaign_id):
        return Response(active_battles.listing(campaign_id))


class CampaignActiveBattleCancelView(CampaignScopedView):
    """POST: a battle manager cancels an open battle for everyone (not once postbattle has begun)."""

    rules = {"POST": "manage_battles"}
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id):
        mode = "campaign_owner" if self.access.role == OWNER else "campaign_manager"
        cancelled = active_battles.cancel(campaign_id, battle_id, request.user, mode)
        if cancelled.version is None:  # already cancelled: the snapshot, nothing sent
            return response_with_snapshot(cancelled.battle_id, cancelled.events)
        return broadcast_response(request, cancelled.battle_id, cancelled.events, cancelled.version, changed=ALL)
