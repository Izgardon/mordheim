"""Reported results waiting for answers: the campaign's list and the submitter's withdraw (BUG-46).

A reported result ends when every other player approves it (approve-result/) and is cancelled when one declines
(decline-result/) or the submitter withdraws it. Clearing its notification only resolves the notification.
"""

from django.db import transaction
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.permissions import get_membership
from apps.core.throttling import BATTLE_WRITE_THROTTLE_CLASSES

from ..models import Battle, BattleParticipant
from ..serializers import display_name, participants_prefetch
from ..services.broadcast import ALL, bump_state_version
from .responses import broadcast_response, response_with_snapshot
from .shared import _cancel_battle_for_all_participants, _get_user_battle_participant


def _pending_result_payload(battle: Battle, user_id: int) -> dict:
    """One pending reported result, read with its participants (`participants_prefetch`) and creator."""
    participants = list(battle.participants.all())
    winner_ids = set(battle.winner_warband_ids_json or [])
    mine = next((entry for entry in participants if entry.user_id == user_id), None)
    ended_at = timezone.localtime(battle.ended_at) if battle.ended_at else None
    return {
        "battle_id": battle.id,
        "campaign_id": battle.campaign_id,
        "status": battle.status,
        "scenario": battle.scenario,
        "battle_date": ended_at.date().isoformat() if ended_at else None,
        "winner_warband_ids": battle.winner_warband_ids_json or [],
        "winner_warband_names": [entry.warband.name for entry in participants if entry.warband_id in winner_ids],
        "created_by_user_id": battle.created_by_user_id,
        "created_by_user_label": display_name(battle.created_by_user),
        "created_at": battle.created_at.isoformat(),
        "participants": [
            {
                "user_id": entry.user_id,
                "user_label": display_name(entry.user),
                "warband_id": entry.warband_id,
                "warband_name": entry.warband.name,
                "status": entry.status,
            }
            for entry in participants
        ],
        "awaiting_my_answer": bool(mine and mine.status == BattleParticipant.STATUS_REPORTED_RESULT_PENDING),
        "can_withdraw": battle.created_by_user_id == user_id,
    }


class CampaignPendingResultsView(APIView):
    """GET: the caller's reported results in this campaign still waiting for answers, newest first (constant
    queries: membership, battles with their creators, participants; BATL-TEST-15)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        if not get_membership(request.user, campaign_id):
            return Response({"detail": "Not found"}, status=404)
        battles = (
            Battle.objects.filter(
                campaign_id=campaign_id,
                flow_type=Battle.FLOW_TYPE_REPORTED_RESULT,
                status=Battle.STATUS_REPORTED_RESULT_PENDING,
                participants__user=request.user,
            )
            .select_related("created_by_user")
            .prefetch_related(participants_prefetch())
            .order_by("-created_at", "-id")
        )
        return Response([_pending_result_payload(battle, request.user.id) for battle in battles])


class CampaignBattleWithdrawResultView(APIView):
    """POST: the submitter takes back a reported result nobody has finished answering; it is cancelled for all."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id):
        events: list[dict] = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if battle.flow_type != Battle.FLOW_TYPE_REPORTED_RESULT:
                return Response({"detail": "This battle is not a reported result"}, status=400)
            if battle.created_by_user_id != request.user.id:
                detail = "Only the player who reported this result can withdraw it"
                return Response({"detail": detail, "code": "not_submitter"}, status=403)
            if battle.status == Battle.STATUS_CANCELED:
                return response_with_snapshot(battle.id, events)
            if battle.status == Battle.STATUS_ENDED:
                return Response({"detail": "Reported result has already been committed"}, status=400)
            events.append(_cancel_battle_for_all_participants(battle, actor_user=request.user, mode="withdrawn"))
            version = bump_state_version(battle)
        return broadcast_response(request, battle.id, events, version, changed=ALL)
