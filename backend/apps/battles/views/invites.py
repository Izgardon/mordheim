"""Answering a battle invitation: accept (join/), decline (decline/), and what follows (BUG-45, BATL-NEW-05).

Invitees can decline until the battle starts (decision 4). A declined or cancelled participant no longer counts:
with fewer than two players left the battle is cancelled, and once everyone left has accepted, prebattle opens.
A declined invitation can't be taken back by joining.
"""

from django.db import transaction
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.throttling import BATTLE_WRITE_THROTTLE_CLASSES
from apps.notifications.models import Notification
from apps.notifications.utils import resolve_notification, resolve_notifications_for_reference

from ..models import Battle, BattleEvent, BattleParticipant
from ..services.broadcast import ALL, bump_state_version
from ..services.lifecycle import participants_all_in
from .shared import (
    _append_battle_event,
    _broadcast_response,
    _cancel_battle_for_all_participants,
    _display_name,
    _get_user_battle_participant,
    _notify_user,
    _response_with_snapshot,
)


def open_prebattle(battle: Battle) -> None:
    """Everyone still in has accepted: prebattle opens for them (no deadline until postbattle)."""
    now = timezone.now()
    battle.status = Battle.STATUS_PREBATTLE
    battle.closes_at = None
    battle.save(update_fields=["status", "closes_at", "updated_at"])
    entries = list(BattleParticipant.objects.select_for_update().filter(battle_id=battle.id))
    for entry in entries:
        if entry.status == BattleParticipant.STATUS_ACCEPTED:
            entry.status = BattleParticipant.STATUS_JOINED_PREBATTLE
            entry.joined_at = entry.joined_at or now
            entry.save(update_fields=["status", "joined_at", "updated_at"])
    payload = {"battle_id": battle.id, "campaign_id": battle.campaign_id, "status": battle.status}
    for entry in entries:
        if entry.status not in BattleParticipant.LEFT_STATUSES:
            _notify_user(entry.user_id, "battle_prebattle_opened", payload)
    resolve_notifications_for_reference(Notification.TYPE_BATTLE_INVITE, str(battle.id))


def settle_after_leaving(battle: Battle, *, actor_user, mode: str) -> list[dict]:
    """After a participant declined or cancelled before the battle started: cancel it when fewer than two players
    are left, or open prebattle once everyone left has accepted. Returns the events added."""
    headcount = participants_all_in(battle.id)
    if headcount.total < 2:
        return [_cancel_battle_for_all_participants(battle, actor_user=actor_user, mode=mode)]
    if battle.status == Battle.STATUS_INVITING and headcount.accepted == headcount.total:
        open_prebattle(battle)
    return []


def decline_invitation(battle: Battle, participant: BattleParticipant, *, actor_user, reason: str) -> list[dict]:
    """The participant declines (or, `reason="expired"`, his 72 hours ran out): his invitation is resolved and the
    creator told. Returns the events added, the battle's cancel among them when too few are left."""
    participant.status = BattleParticipant.STATUS_DECLINED
    participant.responded_at = timezone.now()
    participant.save(update_fields=["status", "responded_at", "updated_at"])
    resolve_notification(participant.user_id, Notification.TYPE_BATTLE_INVITE, str(battle.id))
    label = _display_name(participant.user)
    _notify_user(
        battle.created_by_user_id,
        "battle_invite_declined",
        {
            "battle_id": battle.id,
            "campaign_id": battle.campaign_id,
            "user_id": participant.user_id,
            "user_label": label,
            "reason": reason,
        },  # fmt: skip
    )
    event = _append_battle_event(
        battle,
        BattleEvent.TYPE_PARTICIPANT_DECLINED,
        actor_user=actor_user,
        payload={"participant_user_id": participant.user_id, "reason": reason},
    )
    return [event, *settle_after_leaving(battle, actor_user=actor_user, mode="declined")]


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
                return _response_with_snapshot(battle.id, [])
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
        return _broadcast_response(request, battle.id, events, version, changed=ALL)
