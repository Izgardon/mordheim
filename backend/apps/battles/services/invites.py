"""Answering a battle invitation: accept, decline, and what follows (BUG-45, BATL-NEW-05).

Invitees can decline until the battle starts (decision 4). A declined or cancelled participant no longer counts:
with fewer than two players left the battle is cancelled, and once everyone left has accepted, prebattle opens.
A declined invitation can't be taken back by joining.
"""

from django.utils import timezone

from apps.notifications.models import Notification
from apps.notifications.utils import resolve_notification, resolve_notifications_for_reference
from apps.users.names import display_name

from ..models import Battle, BattleEvent, BattleParticipant
from .events import append_event, notify_user
from .lifecycle import cancel_battle, participants_all_in
from .locks import locked


def open_prebattle(battle: Battle) -> None:
    """Everyone still in has accepted: prebattle opens for them (no deadline until postbattle)."""
    now = timezone.now()
    battle.status = Battle.STATUS_PREBATTLE
    battle.closes_at = None
    battle.save(update_fields=["status", "closes_at", "updated_at"])
    entries = list(locked(BattleParticipant.objects.filter(battle_id=battle.id)))
    for entry in entries:
        if entry.status == BattleParticipant.STATUS_ACCEPTED:
            entry.status = BattleParticipant.STATUS_JOINED_PREBATTLE
            entry.joined_at = entry.joined_at or now
            entry.save(update_fields=["status", "joined_at", "updated_at"])
    payload = {"battle_id": battle.id, "campaign_id": battle.campaign_id, "status": battle.status}
    for entry in entries:
        if entry.status not in BattleParticipant.LEFT_STATUSES:
            notify_user(entry.user_id, "battle_prebattle_opened", payload)
    resolve_notifications_for_reference(Notification.TYPE_BATTLE_INVITE, str(battle.id))


def settle_after_leaving(battle: Battle, *, actor_user, mode: str) -> list[dict]:
    """After a participant declined or cancelled before the battle started: cancel it when fewer than two players
    are left, or open prebattle once everyone left has accepted. Returns the events added."""
    headcount = participants_all_in(battle.id)
    if headcount.total < 2:
        return [cancel_battle(battle, actor_user=actor_user, mode=mode)]
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
    notice = {
        "battle_id": battle.id,
        "campaign_id": battle.campaign_id,
        "user_id": participant.user_id,
        "user_label": display_name(participant.user),
        "reason": reason,
    }
    notify_user(battle.created_by_user_id, "battle_invite_declined", notice)
    event = append_event(
        battle,
        BattleEvent.TYPE_PARTICIPANT_DECLINED,
        actor_user=actor_user,
        payload={"participant_user_id": participant.user_id, "reason": reason},
    )
    return [event, *settle_after_leaving(battle, actor_user=actor_user, mode="declined")]
