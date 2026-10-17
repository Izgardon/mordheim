"""Player-to-player trades: request, answer, offers, locks and completion, close (logic in services/).

Every write locks the trade row (select_for_update) and makes all its changes in that one transaction, so two
players acting at once can't erase each other's lock or offer (BUG-08). Realtime events go out after commit.
"""

from collections.abc import Callable
from datetime import timedelta
from typing import Any

from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.models import CampaignMembership
from apps.campaigns.permissions import get_membership
from apps.core.throttling import TRADE_WRITE_THROTTLE_CLASSES, MethodScopedThrottleMixin
from apps.notifications.models import Notification
from apps.notifications.utils import create_notification, resolve_notification
from apps.realtime.services import (
    send_trade_event,
    send_user_notification,
    serialize_trade_request,
)
from apps.warbands.models import Warband

from .models import TradeRequest
from .selectors import get_trade_for_participant, trade_requests
from .services.errors import TradeError
from .services.lifecycle import (
    answer_request,
    both_locked,
    check_offer_version,
    close,
    complete_or_reopen,
    expire,
    expire_due,
    is_due,
    lock_side,
    side_of,
    unlock_side,
    update_offer,
)

TradeAction = Callable[[TradeRequest, str], Response]
LISTED_STATUSES = {status for status, _label in TradeRequest.STATUS_CHOICES}


def _act(
    request: Request, campaign_id: int, request_id: Any, action: TradeAction, *, recipient_only: bool = False
) -> Response:
    """Run `action(trade, side)` on the locked trade. An open trade past due is expired instead (that is kept and
    answered 400); a TradeError rolls the action back and answers its status."""
    try:
        with transaction.atomic():
            trade = get_trade_for_participant(
                request.user, campaign_id, request_id, lock=True, recipient_only=recipient_only
            )
            if is_due(trade):
                expire(trade)
                return Response({"detail": "Trade request expired"}, status=400)
            return action(trade, side_of(trade, request.user))
    except TradeError as refused:
        return Response(refused.body(), status=refused.status)


class UserPendingTradeRequestListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        waiting = TradeRequest.objects.filter(to_user=request.user, status=TradeRequest.STATUS_PENDING)
        # pending requests have no traders to give back, so one guarded UPDATE expires them
        waiting.filter(expires_at__lte=now).update(status=TradeRequest.STATUS_EXPIRED, responded_at=now)
        requests = trade_requests().filter(to_user=request.user, status=TradeRequest.STATUS_PENDING, expires_at__gt=now)
        return Response([serialize_trade_request(entry) for entry in requests.order_by("-created_at")])


class CampaignTradeRequestListCreateView(MethodScopedThrottleMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = TRADE_WRITE_THROTTLE_CLASSES

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        status_filter = request.query_params.get("status")
        if status_filter and status_filter not in LISTED_STATUSES:
            return Response({"detail": "Invalid status"}, status=400)

        # BUG-69 (decision 8): reading the list still expires the campaign's open trades that are past due
        due = TradeRequest.objects.filter(
            campaign_id=campaign_id, status=TradeRequest.STATUS_ACCEPTED, expires_at__lte=timezone.now()
        )
        due_ids = list(due.values_list("id", flat=True))
        if due_ids:
            expire_due(TradeRequest.objects.filter(id__in=due_ids))

        queryset = trade_requests().filter(campaign_id=campaign_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        queryset = queryset.order_by("-responded_at", "-created_at")
        return Response([serialize_trade_request(entry) for entry in queryset])

    def post(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        target_user_id = request.data.get("target_user_id")
        if not target_user_id:
            return Response({"detail": "target_user_id is required"}, status=400)

        try:
            target_user_id = int(target_user_id)
        except (TypeError, ValueError):
            return Response({"detail": "Invalid target_user_id"}, status=400)

        if target_user_id == request.user.id:
            return Response({"detail": "Cannot trade with yourself"}, status=400)

        target_membership = CampaignMembership.objects.filter(campaign_id=campaign_id, user_id=target_user_id).first()
        if not target_membership:
            return Response({"detail": "Player not found"}, status=404)

        from_warband = Warband.objects.filter(campaign_id=campaign_id, user_id=request.user.id).first()
        to_warband = Warband.objects.filter(campaign_id=campaign_id, user_id=target_user_id).first()

        if not from_warband or not to_warband:
            return Response(
                {"detail": "Both players need a warband to trade"},
                status=400,
            )

        trade_request = TradeRequest.objects.create(
            campaign_id=campaign_id,
            from_user=request.user,
            to_user_id=target_user_id,
            from_warband=from_warband,
            to_warband=to_warband,
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        trade_request = trade_requests().get(id=trade_request.id)
        payload = serialize_trade_request(trade_request)
        notif = create_notification(
            user_id=target_user_id,
            notification_type=Notification.TYPE_TRADE_REQUEST,
            reference_id=str(trade_request.id),
            campaign_id=campaign_id,
            payload=payload,
        )
        send_user_notification(target_user_id, "trade_request", {**payload, "notification_id": notif.id})

        return Response(payload, status=status.HTTP_201_CREATED)


class CampaignTradeOfferUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = TRADE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, request_id):
        def offer(trade: TradeRequest, side: str) -> Response:
            update_offer(trade, side, request.data)
            payload = serialize_trade_request(trade)
            send_trade_event(trade.id, "trade.offer_updated", payload)
            return Response(payload)

        return _act(request, campaign_id, request_id, offer)


class CampaignTradeRequestDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id, request_id):
        trade = get_trade_for_participant(request.user, campaign_id, request_id, hidden=True)
        if is_due(trade):
            with transaction.atomic():
                trade = get_trade_for_participant(request.user, campaign_id, request_id, lock=True, hidden=True)
                if is_due(trade):
                    expire(trade)
        return Response(serialize_trade_request(trade))


class CampaignTradeRequestAcceptView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = TRADE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, request_id):
        def accept(trade: TradeRequest, side: str) -> Response:
            answer_request(trade, accept=True)
            resolve_notification(request.user.id, Notification.TYPE_TRADE_REQUEST, str(trade.id))
            payload = serialize_trade_request(trade)
            send_trade_event(trade.id, "trade.accepted", payload)
            send_user_notification(trade.from_user_id, "trade_accepted", payload)
            return Response(payload)

        return _act(request, campaign_id, request_id, accept, recipient_only=True)


def _shown_offer_version(request: Request) -> int | None:
    """The `offer_version` a lock was sent with: None when absent; TradeError (400) when not a whole number."""
    shown = request.data.get("offer_version") if isinstance(request.data, dict) else None
    if shown is None:
        return None
    if isinstance(shown, bool) or not str(shown).strip().isdigit():
        raise TradeError("offer_version must be a whole number.", code="invalid")
    return int(shown)


class CampaignTradeOfferAcceptView(APIView):
    """Lock: the caller accepts both offers as they stand, at the `offer_version` it was shown when it sends one
    (409 `offer_changed` otherwise; without one, older clients lock whatever stands). The second lock completes
    the trade in the same transaction, or unlocks both sides with a 409 when it can't (BUG-41)."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = TRADE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, request_id):
        def lock(trade: TradeRequest, side: str) -> Response:
            try:
                check_offer_version(trade, _shown_offer_version(request))
            except TradeError as changed:
                return Response({**changed.body(), "trade": serialize_trade_request(trade)}, status=changed.status)
            lock_side(trade, side)
            locked = serialize_trade_request(trade)
            if not both_locked(trade):
                send_trade_event(trade.id, "trade.locked", locked)
                return Response(locked)
            failure = complete_or_reopen(trade)
            payload = serialize_trade_request(trade)
            if failure is not None:
                send_trade_event(trade.id, "trade.offer_updated", {**payload, "error": failure.body()})
                return Response({**failure.body(), "trade": payload}, status=failure.status)
            send_trade_event(trade.id, "trade.locked", locked)
            send_trade_event(trade.id, "trade.completed", payload)
            return Response(payload)

        return _act(request, campaign_id, request_id, lock)


class CampaignTradeOfferUnlockView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = TRADE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, request_id):
        def unlock(trade: TradeRequest, side: str) -> Response:
            unlock_side(trade, side)
            payload = serialize_trade_request(trade)
            send_trade_event(trade.id, "trade.offer_updated", payload)
            return Response(payload)

        return _act(request, campaign_id, request_id, unlock)


class CampaignTradeRequestDeclineView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = TRADE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, request_id):
        def decline(trade: TradeRequest, side: str) -> Response:
            answer_request(trade, accept=False)
            resolve_notification(request.user.id, Notification.TYPE_TRADE_REQUEST, str(trade.id))
            payload = serialize_trade_request(trade)
            send_user_notification(trade.from_user_id, "trade_declined", payload)
            return Response(payload)

        return _act(request, campaign_id, request_id, decline, recipient_only=True)


class CampaignTradeRequestCloseView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = TRADE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, request_id):
        def close_trade(trade: TradeRequest, side: str) -> Response:
            close(trade)
            payload = serialize_trade_request(trade)
            send_trade_event(trade.id, "trade.closed", payload)
            return Response(payload)

        return _act(request, campaign_id, request_id, close_trade)
