"""The notifications a user sees: his unresolved ones that can still be answered, newest first (one query)."""

from typing import Any

from django.db.models import Q, QuerySet

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
