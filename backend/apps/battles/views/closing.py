"""Skipping postbattle and closing it for everyone (decision 3, BUG-09, BATL-TWEAK-02).

A skipped player's results aren't applied, but the single-use items he used are used up (BUG-72). Close postbattle
skips everyone who hasn't finished and ends the battle, which records the wins and losses; it is the way out of a
postbattle, since cancelling refuses one.
"""

from django.db import transaction
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.permissions import get_membership, has_campaign_permission
from apps.core.throttling import BATTLE_WRITE_THROTTLE_CLASSES

from ..models import Battle, BattleEvent, BattleParticipant
from ..services.broadcast import ALL, bump_state_version
from ..services.events import append_event
from ..validation.postbattle import empty_draft
from .responses import broadcast_response, response_with_snapshot
from .shared import _finalize_battle, _remove_used_single_use_items


def skip_postbattle(battle: Battle, participant: BattleParticipant, *, actor_user, closed_by=None) -> dict:
    """Mark the participant's postbattle skipped and return its event: nothing applied, the items used in battle
    used up, the draft cleared. `closed_by` is whoever closed postbattle for him."""
    _remove_used_single_use_items(battle, participant)
    participant.postbattle_json = empty_draft()
    participant.status = BattleParticipant.STATUS_CONFIRMED_POSTBATTLE
    participant.skipped_postbattle = True
    participant.confirmed_at = timezone.now()
    participant.save(update_fields=["postbattle_json", "status", "skipped_postbattle", "confirmed_at", "updated_at"])
    payload: dict = {"participant_user_id": participant.user_id, "skipped_postbattle": True}
    if closed_by is not None:
        payload["closed_by_user_id"] = closed_by.id
    return append_event(
        battle, BattleEvent.TYPE_PARTICIPANT_CONFIRMED_POSTBATTLE, actor_user=actor_user, payload=payload
    )


def close_postbattle(battle: Battle, *, actor_user, mode: str) -> list[dict]:
    """Skip every participant still in postbattle and end the battle (wins and losses recorded); the battle is
    locked. `actor_user` is None when the deadline closed it (mode "expired"). Returns the events."""
    unfinished = BattleParticipant.objects.select_for_update().filter(
        battle_id=battle.id, status=BattleParticipant.STATUS_FINISHED_BATTLE
    )
    events = [skip_postbattle(battle, entry, actor_user=actor_user, closed_by=actor_user) for entry in unfinished]
    closed_by_user_id = actor_user.id if actor_user else None
    _finalize_battle(battle, actor_user, events, closed_by_user_id=closed_by_user_id, mode=mode)
    return events


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
