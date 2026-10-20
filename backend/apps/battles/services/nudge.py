"""Nudging a player who is holding up the battle (BATL-NEW-08).

Any player still in an open battle can nudge another who still has something to do in it (services/unfinished.py):
that player gets a `battle_nudge` notification (kept in his list until the battle is over, and sent in realtime) and
the battle's timeline a `participant_nudged` event. One nudge per pair of players per battle every 10 minutes.
"""

from datetime import timedelta

from django.db.models import CharField, QuerySet
from django.db.models.functions import Cast
from django.utils import timezone

from apps.notifications.models import Notification
from apps.notifications.utils import create_notification

from ..models import Battle, BattleEvent, BattleParticipant
from ..serializers import display_name
from .errors import BattleError
from .events import append_event, notify_user
from .unfinished import BUSY_BATTLE_STATUSES, is_unfinished, page_for

NUDGE_INTERVAL = timedelta(minutes=10)


def _target(battle: Battle, user_id: int) -> BattleParticipant:
    target = BattleParticipant.objects.select_related("user").filter(battle_id=battle.id, user_id=user_id).first()
    if target is None:
        raise BattleError("Nudge a player in this battle", fields={"user_id": ["Pick a player in this battle."]})
    if not is_unfinished(battle, target):
        raise BattleError("That player isn't holding up the battle", code="not_holding_up")
    return target


def _too_soon(battle: Battle, nudger, target: BattleParticipant, now) -> None:
    last = (
        BattleEvent.objects.filter(
            battle_id=battle.id,
            type=BattleEvent.TYPE_PARTICIPANT_NUDGED,
            actor_user=nudger,
            payload_json__target_user_id=target.user_id,
            created_at__gt=now - NUDGE_INTERVAL,
        )
        .order_by("-created_at")
        .values_list("created_at", flat=True)
        .first()
    )
    if last is not None:
        wait = int((last + NUDGE_INTERVAL - now).total_seconds()) + 1
        raise BattleError(
            "You nudged that player less than 10 minutes ago", code="nudged_recently", status=429, retry_after=wait
        )


def nudge(battle: Battle, nudger_participant: BattleParticipant, target_user_id: int, actor) -> dict:
    """Nudge the target player (the battle is locked); returns the timeline event."""
    if target_user_id == actor.id:
        raise BattleError("You can't nudge yourself", fields={"user_id": ["Pick another player."]})
    target = _target(battle, target_user_id)
    now = timezone.now()
    _too_soon(battle, actor, target, now)
    payload = {
        "battle_id": battle.id,
        "campaign_id": battle.campaign_id,
        "status": battle.status,
        "scenario": battle.scenario,
        "page": page_for(battle, target),  # where he finishes his part
        "nudged_by_user_id": actor.id,
        "nudged_by_user_label": display_name(actor),
        "nudged_at": now.isoformat(),
    }
    notification = create_notification(
        target.user_id, Notification.TYPE_BATTLE_NUDGE, str(battle.id), battle.campaign_id, payload
    )
    notify_user(target.user_id, "battle_nudge", {**payload, "notification_id": notification.id})
    event = {"target_user_id": target.user_id, "nudged_by_user_id": actor.id}
    return append_event(battle, BattleEvent.TYPE_PARTICIPANT_NUDGED, actor_user=actor, payload=event)


def open_battle_refs() -> QuerySet:
    """The ids, as notification references, of battles still open: a nudge about any other reads as gone."""
    open_battles = Battle.objects.filter(status__in=BUSY_BATTLE_STATUSES)
    return open_battles.annotate(ref=Cast("id", output_field=CharField())).values("ref")
