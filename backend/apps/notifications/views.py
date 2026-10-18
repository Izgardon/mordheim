from django.db import transaction
from django.db.models import Q, QuerySet
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification


def _serialize_notification(n: Notification) -> dict:
    return {
        "id": n.id,
        "notification_type": n.notification_type,
        "campaign_id": n.campaign_id,
        "reference_id": n.reference_id,
        "payload": n.payload,
        "created_at": n.created_at.isoformat(),
    }


def _without_stale_trade_requests(rows: QuerySet[Notification]) -> QuerySet[Notification]:
    """Trade-request notifications only while the request can still be answered: one that ran out reads as gone,
    without a write (decision 8). Same single query."""
    from apps.trades.selectors import answerable_request_refs

    stale = Q(notification_type=Notification.TYPE_TRADE_REQUEST) & ~Q(reference_id__in=answerable_request_refs())
    return rows.exclude(stale)


class NotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        unresolved = Notification.objects.filter(user=request.user, is_resolved=False)
        notifications = _without_stale_trade_requests(unresolved).order_by("-created_at")
        return Response([_serialize_notification(n) for n in notifications])


class NotificationClearView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, notification_id):
        notification = Notification.objects.filter(id=notification_id, user=request.user, is_resolved=False).first()
        if not notification:
            return Response({"detail": "Not found"}, status=404)

        now = timezone.now()
        with transaction.atomic():
            _apply_clear_side_effects(notification, request.user, now)
            notification.is_resolved = True
            notification.resolved_at = now
            notification.save(update_fields=["is_resolved", "resolved_at"])

        return Response({"ok": True})


class NotificationClearAllView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        notifications = list(Notification.objects.filter(user=request.user, is_resolved=False))
        now = timezone.now()
        with transaction.atomic():
            for notification in notifications:
                _apply_clear_side_effects(notification, request.user, now)
            Notification.objects.filter(user=request.user, is_resolved=False).update(is_resolved=True, resolved_at=now)
        return Response({"ok": True})


def _apply_clear_side_effects(notification: Notification, user, now) -> None:
    if notification.notification_type == Notification.TYPE_TRADE_REQUEST:
        _clear_trade_request(notification, user, now)
    # Battle invites and reported-result requests: just resolved. A result is answered on the campaign overview
    # (approve, decline, or withdraw for its submitter), never by clearing (BUG-46, BUG-121).


def _clear_trade_request(notification: Notification, user, now) -> None:
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
