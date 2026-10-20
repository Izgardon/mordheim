"""Clearing notifications: one, or all of a user's at once.

Clearing one resolves it. A pending trade request is also answered: declined (its sender is told after commit), or
expired once it has run out. Battle invites and reported-result requests are only resolved: a result is answered on
the campaign overview (approve, decline, or withdraw for its submitter), never by clearing (BUG-46, BUG-121).

Clear all resolves only the notifications that can no longer be answered and answers nothing: invitations and
requests that still need an answer stay until they are answered (CAMP-TWEAK-10, IMP-78).
"""

from datetime import datetime
from typing import Any

from django.db import transaction
from django.utils import timezone

from . import selectors
from .models import Notification


def clear(user: Any, notification_id: int) -> bool:
    """Clear one of the user's unresolved notifications; False when he has no such notification."""
    notification = Notification.objects.filter(id=notification_id, user=user, is_resolved=False).first()
    if not notification:
        return False
    now = timezone.now()
    with transaction.atomic():
        _apply_clear_side_effects(notification, user, now)
        notification.is_resolved = True
        notification.resolved_at = now
        notification.save(update_fields=["is_resolved", "resolved_at"])
    return True


def clear_all(user: Any) -> dict[str, int]:
    """Resolve the user's notifications that can no longer be answered (a trade request answered or run out, an
    invitation to a battle past inviting, a settled result, a nudge about a finished battle) in one UPDATE, and
    decline nothing. Returns how many were cleared and how many are still listed."""
    stale = Notification.objects.filter(user=user, is_resolved=False).exclude(selectors.answerable(user))
    cleared = stale.update(is_resolved=True, resolved_at=timezone.now())
    return {"cleared": cleared, "kept": selectors.listed(user).count()}


def _apply_clear_side_effects(notification: Notification, user: Any, now: datetime) -> None:
    if notification.notification_type == Notification.TYPE_TRADE_REQUEST:
        _clear_trade_request(notification, user, now)


def _clear_trade_request(notification: Notification, user: Any, now: datetime) -> None:
    from apps.realtime.services import send_user_notification
    from apps.trades.models import TradeRequest
    from apps.trades.serializers import serialize_trade_request
    from apps.trades.services.lifecycle import answer_request, expire

    # Under the trade's row lock, like every trade write, so an accept at the same moment can't be overwritten.
    trade_request = (
        TradeRequest.objects.select_for_update(of=("self",))
        .select_related("from_user", "to_user", "from_warband", "to_warband")
        .filter(id=notification.reference_id, to_user=user)
        .first()
    )
    if not trade_request or trade_request.status != TradeRequest.STATUS_PENDING:
        return

    if trade_request.expires_at <= now:
        expire(trade_request)
        return

    answer_request(trade_request, accept=False)
    payload = serialize_trade_request(trade_request)
    from_user_id = trade_request.from_user_id
    transaction.on_commit(
        lambda uid=from_user_id, data=payload: send_user_notification(uid, "trade_declined", data)  # type: ignore[misc]
    )
