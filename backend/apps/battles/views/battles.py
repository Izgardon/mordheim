"""A campaign's battles: the list (and `?open=1`), creating a battle, and one battle's state and rosters."""

import logging

from django.db import transaction
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.permissions import get_membership, get_writable_membership
from apps.core.throttling import BATTLE_WRITE_THROTTLE_CLASSES, MethodScopedThrottleMixin

from ..models import Battle
from ..serializers import PARTICIPANT_VIEWS, battle_state_payload, participants_prefetch, snapshot_from_battle
from ..services.broadcast import ALL
from ..services.capabilities import capabilities
from ..services.errors import Refused
from ..services.expiry import expire_overdue
from ..services.finishing import results_sides
from ..services.postbattle.suggested import postbattle_guide
from ..services.presence import mark_participant_seen
from ..services.rosters import battle_rosters_payload
from ..services.setup import create_battle, new_battle
from ..services.unfinished import viewer, viewer_in
from ..services.warnings import campaign_warnings
from .base import BattleScopedView, Scope
from .responses import broadcast_response, with_capabilities

logger = logging.getLogger(__name__)


class CampaignBattleListCreateView(MethodScopedThrottleMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def get(self, request, campaign_id):
        if not get_membership(request.user, campaign_id):
            return Response({"detail": "Not found"}, status=404)
        battles = (
            Battle.objects.filter(campaign_id=campaign_id, participants__user=request.user)
            .distinct()
            .order_by("-created_at")
            .prefetch_related(participants_prefetch())
        )
        # ?open=1 skips finished history: callers looking for a resumable battle don't need every battle
        if request.query_params.get("open") in {"1", "true"}:
            battles = battles.exclude(status__in=(Battle.STATUS_ENDED, Battle.STATUS_CANCELED))
        if expire_overdue(battles):  # settle what is past its deadline (decision 2), then read again
            battles = battles.all()
        # each with the reader's place in it: his unfinished battle is the first unfinished one (BATL-NEW-01)
        return Response(
            [{**snapshot_from_battle(battle), "viewer": viewer_in(battle, request.user.id)} for battle in battles]
        )

    def post(self, request, campaign_id):
        membership = get_writable_membership(request.user, campaign_id)  # an archived campaign: 403
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        try:
            requested = new_battle(request.data, campaign_id, request.user)
        except Refused as refused:
            return refused.response()
        logger.info(
            "Battle create requested campaign_id=%s user_id=%s participants=%s ratings=%s scenario=%r scenario_link=%r",
            campaign_id,
            request.user.id,
            requested.user_ids,
            requested.ratings,
            requested.scenario,
            requested.scenario_link,
        )
        try:
            with transaction.atomic():
                battle, events = create_battle(campaign_id, request.user, requested)
        except Exception:
            logger.exception(
                "Battle create failed campaign_id=%s user_id=%s participants=%s",
                campaign_id,
                request.user.id,
                requested.user_ids,
            )
            raise
        answer = broadcast_response(
            request,
            battle.id,
            events,
            battle.state_version,
            changed=ALL,
            response_status=status.HTTP_201_CREATED,
            warnings=[*campaign_warnings(membership.campaign.in_progress), *requested.warnings],
        )
        return with_capabilities(answer, request.user.id, False)  # inviting: nothing a battle manager adds yet


class CampaignBattleStateView(BattleScopedView):
    battle_related = ("campaign__settings",)  # the hero death roll in the postbattle rules

    def get(self, request, campaign_id, battle_id):
        scope = self.read(request, campaign_id, battle_id)
        if not isinstance(scope, Scope):
            return scope
        try:
            since_event_id = max(0, int(request.query_params.get("sinceEventId", "0")))
        except (TypeError, ValueError):
            return Response({"detail": "Invalid sinceEventId"}, status=400)
        view = str(request.query_params.get("view", "full")).strip().lower() or "full"
        if view not in PARTICIPANT_VIEWS:
            return Response({"detail": "Invalid view"}, status=400)
        payload = battle_state_payload(scope.battle, since_event_id, participant_view=view)
        participants = scope.battle.participants.all()
        payload["capabilities"] = capabilities(scope.battle, request.user.id, participants)
        if payload["capabilities"]["confirm_results"]:  # where the Confirm results modal starts (decision 4)
            payload["confirm_results"] = results_sides(scope.battle, participants)
        payload["viewer"] = viewer(scope.battle, scope.player)
        if view == "postbattle":  # the server's suggestions and rules (IMP-52)
            payload.update(postbattle_guide(scope.battle, scope.player))
        mark_participant_seen(scope.player)
        return Response(payload)


class CampaignBattleRosterView(BattleScopedView):
    def get(self, request, campaign_id, battle_id):
        scope = self.read(request, campaign_id, battle_id)
        if not isinstance(scope, Scope):
            return scope
        mark_participant_seen(scope.player)
        return Response(battle_rosters_payload(scope.battle.id))
