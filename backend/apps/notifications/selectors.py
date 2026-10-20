"""The notifications a user sees: his unresolved ones that can still be answered, newest first (one query); and
which of them still need his answer (`answerable`, what Clear all keeps)."""

from typing import Any

from django.db.models import CharField, Q, QuerySet
from django.db.models.functions import Cast
from django.utils import timezone

from .models import Notification


def serialize(notification: Notification) -> dict[str, Any]:
    return {
        "id": notification.id,
        "notification_type": notification.notification_type,
        "campaign_id": notification.campaign_id,
        "reference_id": notification.reference_id,
        "payload": notification.payload,
        "created_at": notification.created_at.isoformat(),
    }


def _without_stale_trade_requests(rows: QuerySet[Notification]) -> QuerySet[Notification]:
    """Trade-request notifications only while the request can still be answered: one that ran out reads as gone,
    without a write (decision 8). Same single query."""
    from apps.trades.selectors import answerable_request_refs

    stale = Q(notification_type=Notification.TYPE_TRADE_REQUEST) & ~Q(reference_id__in=answerable_request_refs())
    return rows.exclude(stale)


def _without_stale_battle_nudges(rows: QuerySet[Notification]) -> QuerySet[Notification]:
    """A nudge only while its battle is open (BATL-NEW-08): one about a finished battle reads as gone, without a
    write. Same single query."""
    from apps.battles.services.nudge import open_battle_refs

    stale = Q(notification_type=Notification.TYPE_BATTLE_NUDGE) & ~Q(reference_id__in=open_battle_refs())
    return rows.exclude(stale)


def listed(user: Any) -> QuerySet[Notification]:
    unresolved = Notification.objects.filter(user=user, is_resolved=False)
    return _without_stale_battle_nudges(_without_stale_trade_requests(unresolved)).order_by("-created_at")


def answerable(user: Any) -> Q:
    """The notifications that still need the user's answer (CAMP-TWEAK-10): a trade request still pending and not
    run out, an invitation he hasn't answered to a battle still inviting and in time, a reported result still
    waiting for his approval, and a nudge about a battle still open. Subqueries: no query of its own."""
    from apps.battles.models import Battle, BattleParticipant
    from apps.battles.services.nudge import open_battle_refs
    from apps.trades.selectors import answerable_request_refs

    def his_battles(**lookup: Any) -> QuerySet:
        places = BattleParticipant.objects.filter(user=user, **lookup)
        return places.annotate(ref=Cast("battle_id", output_field=CharField())).values("ref")

    in_time = Q(battle__closes_at__isnull=True) | Q(battle__closes_at__gt=timezone.now())
    invited = his_battles(status=BattleParticipant.STATUS_INVITED, battle__status=Battle.STATUS_INVITING).filter(
        in_time
    )
    pending = BattleParticipant.STATUS_REPORTED_RESULT_PENDING
    to_approve = his_battles(status=pending, battle__status=Battle.STATUS_REPORTED_RESULT_PENDING)
    return (
        Q(notification_type=Notification.TYPE_TRADE_REQUEST, reference_id__in=answerable_request_refs())
        | Q(notification_type=Notification.TYPE_BATTLE_INVITE, reference_id__in=invited)
        | Q(notification_type=Notification.TYPE_BATTLE_RESULT_REQUEST, reference_id__in=to_approve)
        | Q(notification_type=Notification.TYPE_BATTLE_NUDGE, reference_id__in=open_battle_refs())
    )
