from django.db import transaction
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


class NotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(user=request.user, is_resolved=False).order_by("-created_at")
        return Response([_serialize_notification(n) for n in notifications])


class NotificationClearView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, notification_id):
        notification = Notification.objects.filter(
            id=notification_id, user=request.user, is_resolved=False
        ).first()
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
            Notification.objects.filter(user=request.user, is_resolved=False).update(
                is_resolved=True, resolved_at=now
            )
        return Response({"ok": True})


def _apply_clear_side_effects(notification: Notification, user, now) -> None:  # type: ignore[no-untyped-def]
    if notification.notification_type == Notification.TYPE_TRADE_REQUEST:
        _clear_trade_request(notification, user, now)
    elif notification.notification_type == Notification.TYPE_BATTLE_RESULT_REQUEST:
        _clear_battle_result_request(notification, user, now)
    # TYPE_BATTLE_INVITE: just mark resolved, no game action needed


def _clear_trade_request(notification: Notification, user, now) -> None:  # type: ignore[no-untyped-def]
    from apps.realtime.services import send_user_notification, serialize_trade_request
    from apps.trades.models import TradeRequest

    trade_request = (
        TradeRequest.objects.select_related("from_user", "to_user", "from_warband", "to_warband")
        .filter(id=notification.reference_id, to_user=user)
        .first()
    )
    if not trade_request or trade_request.status != TradeRequest.STATUS_PENDING:
        return

    if trade_request.expires_at <= now:
        trade_request.status = TradeRequest.STATUS_EXPIRED
        trade_request.responded_at = now
        trade_request.save(update_fields=["status", "responded_at"])
        return

    trade_request.status = TradeRequest.STATUS_DECLINED
    trade_request.responded_at = now
    trade_request.save(update_fields=["status", "responded_at"])
    payload = serialize_trade_request(trade_request)
    from_user_id = trade_request.from_user_id
    transaction.on_commit(
        lambda uid=from_user_id, data=payload: send_user_notification(uid, "trade_declined", data)  # type: ignore[misc]
    )


def _clear_battle_result_request(notification: Notification, user, now) -> None:  # type: ignore[no-untyped-def]
    from apps.battles.models import Battle, BattleParticipant
    from apps.realtime.services import send_user_notification

    try:
        battle_id = int(notification.reference_id)
    except (TypeError, ValueError):
        return

    battle = Battle.objects.filter(
        id=battle_id,
        flow_type=Battle.FLOW_TYPE_REPORTED_RESULT,
        status=Battle.STATUS_REPORTED_RESULT_PENDING,
    ).first()
    if not battle:
        return

    participant = BattleParticipant.objects.filter(
        battle_id=battle_id,
        user=user,
        status=BattleParticipant.STATUS_REPORTED_RESULT_PENDING,
    ).first()
    if not participant:
        return

    participant.status = BattleParticipant.STATUS_REPORTED_RESULT_DECLINED
    participant.responded_at = now
    participant.save(update_fields=["status", "responded_at", "updated_at"])

    battle.status = Battle.STATUS_CANCELED
    battle.ended_at = battle.ended_at or now
    battle.save(update_fields=["status", "ended_at", "updated_at"])

    from .utils import resolve_notifications_for_reference

    resolve_notifications_for_reference(Notification.TYPE_BATTLE_RESULT_REQUEST, str(battle_id))

    participant_user_ids = list(
        BattleParticipant.objects.filter(battle_id=battle_id).values_list("user_id", flat=True)
    )
    campaign_id = battle.campaign_id
    transaction.on_commit(
        lambda ids=participant_user_ids, bid=battle_id, cid=campaign_id: _send_battle_result_updated(ids, bid, cid)  # type: ignore[misc]
    )


def _send_battle_result_updated(user_ids: list, battle_id: int, campaign_id: int) -> None:
    from apps.realtime.services import send_user_notification

    for uid in user_ids:
        send_user_notification(
            uid,
            "battle_result_updated",
            {"battle_id": battle_id, "campaign_id": campaign_id, "status": "canceled"},
        )
