"""Player-to-player trades: request, answer, offers, locks and completion, close.

Each write runs one service (services/) on the trade locked for its player (actions.run_trade_action); realtime
events go out after commit, skipping the sender's own socket when it names it (ECON-PERF-02).
"""

from typing import Any

from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.throttling import TRADE_WRITE_THROTTLE_CLASSES, MethodScopedThrottleMixin
from apps.notifications.models import Notification
from apps.notifications.utils import resolve_notification
from apps.realtime.services import send_trade_event, send_user_notification, sender_socket_id

from .actions import run_trade_action
from .models import TradeRequest
from .selectors import get_trade_for_participant, player_trades, require_member, trade_requests
from .serializers import serialize_completed_trade, serialize_trade_request
from .services.errors import TradeError
from .services.lifecycle import (
    answer_request,
    both_locked,
    check_offer_version,
    close,
    complete_or_reopen,
    expire,
    expire_due,
    lock_side,
    unlock_side,
    update_offer,
)
from .services.requests import request_trade
from .services.timing import is_due


def _broadcast(request: Request, trade: TradeRequest, event: str, payload: dict[str, Any]) -> None:
    send_trade_event(trade.id, event, payload, socket_id=sender_socket_id(request))


class UserPendingTradeRequestListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        waiting = TradeRequest.objects.filter(to_user=request.user, status=TradeRequest.STATUS_PENDING)
        # pending requests have no traders to give back, so one guarded UPDATE expires them
        waiting.filter(expires_at__lte=now).update(status=TradeRequest.STATUS_EXPIRED, responded_at=now)
        requests = trade_requests().filter(
            to_user=request.user,
            status=TradeRequest.STATUS_PENDING,
            expires_at__gt=now,
            campaign__memberships__user=request.user,  # not from a campaign the player has left (SEC-08)
        )
        return Response([serialize_trade_request(entry) for entry in requests.order_by("-created_at")])


class CampaignTradeRequestListCreateView(MethodScopedThrottleMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = TRADE_WRITE_THROTTLE_CLASSES

    def get(self, request, campaign_id):
        require_member(request.user, campaign_id)
        try:
            trades = player_trades(request.user, campaign_id, request.query_params.get("status"))
        except TradeError as refused:
            return Response(refused.body(), status=refused.status)
        # BUG-69 (decision 8): reading the list still expires the campaign's open trades that are past due
        due = TradeRequest.objects.filter(
            campaign_id=campaign_id, status=TradeRequest.STATUS_ACCEPTED, expires_at__lte=timezone.now()
        )
        due_ids = list(due.values_list("id", flat=True))
        if due_ids:
            expire_due(TradeRequest.objects.filter(id__in=due_ids))
        return Response([serialize_trade_request(entry) for entry in trades])

    def post(self, request, campaign_id):
        require_member(request.user, campaign_id)
        try:
            with transaction.atomic():  # one open trade per pair of warbands (BUG-114)
                trade, notice = request_trade(campaign_id, request.user, request.data.get("target_user_id"))
                send_user_notification(
                    trade.to_user_id, "trade_request", {**notice.payload, "notification_id": notice.id}
                )
        except TradeError as refused:
            return Response(refused.body(), status=refused.status)
        return Response(notice.payload, status=status.HTTP_201_CREATED)


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


class TradeWriteView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = TRADE_WRITE_THROTTLE_CLASSES


class CampaignTradeRequestAcceptView(TradeWriteView):
    def post(self, request, campaign_id, request_id):
        def accept(trade: TradeRequest, side: str) -> Response:
            answer_request(trade, accept=True)
            resolve_notification(request.user.id, Notification.TYPE_TRADE_REQUEST, str(trade.id))
            payload = serialize_trade_request(trade)
            _broadcast(request, trade, "trade.accepted", payload)
            send_user_notification(trade.from_user_id, "trade_accepted", payload)
            return Response(payload)

        return run_trade_action(request, campaign_id, request_id, accept, recipient_only=True, needs_partner=True)


class CampaignTradeRequestDeclineView(TradeWriteView):
    def post(self, request, campaign_id, request_id):
        def decline(trade: TradeRequest, side: str) -> Response:
            answer_request(trade, accept=False)
            resolve_notification(request.user.id, Notification.TYPE_TRADE_REQUEST, str(trade.id))
            payload = serialize_trade_request(trade)
            send_user_notification(trade.from_user_id, "trade_declined", payload)
            return Response(payload)

        return run_trade_action(request, campaign_id, request_id, decline, recipient_only=True)


class CampaignTradeOfferUpdateView(TradeWriteView):
    def post(self, request, campaign_id, request_id):
        def offer(trade: TradeRequest, side: str) -> Response:
            update_offer(trade, side, request.data)
            payload = serialize_trade_request(trade)
            _broadcast(request, trade, "trade.offer_updated", payload)
            return Response(payload)

        return run_trade_action(request, campaign_id, request_id, offer, needs_partner=True)


class CampaignTradeOfferAcceptView(TradeWriteView):
    """Lock: the caller accepts both offers as they stand, at the `offer_version` it was shown when it sends one
    (409 `offer_changed` otherwise; without one, older clients lock whatever stands). The second lock completes
    the trade in the same transaction, or unlocks both sides with a 409 when it can't (BUG-41)."""

    def post(self, request, campaign_id, request_id):
        def lock(trade: TradeRequest, side: str) -> Response:
            try:
                check_offer_version(trade, request.data)
            except TradeError as changed:
                return Response({**changed.body(), "trade": serialize_trade_request(trade)}, status=changed.status)
            lock_side(trade, side)
            locked = serialize_trade_request(trade)
            if not both_locked(trade):
                _broadcast(request, trade, "trade.locked", locked)
                return Response(locked)
            failure = complete_or_reopen(trade)
            if failure is not None:
                reopened = serialize_trade_request(trade)
                _broadcast(request, trade, "trade.offer_updated", {**reopened, "error": failure.body()})
                return Response({**failure.body(), "trade": reopened}, status=failure.status)
            completed = serialize_completed_trade(trade)
            _broadcast(request, trade, "trade.locked", locked)
            _broadcast(request, trade, "trade.completed", completed)
            return Response(completed)

        return run_trade_action(request, campaign_id, request_id, lock, needs_partner=True)


class CampaignTradeOfferUnlockView(TradeWriteView):
    def post(self, request, campaign_id, request_id):
        def unlock(trade: TradeRequest, side: str) -> Response:
            unlock_side(trade, side)
            payload = serialize_trade_request(trade)
            _broadcast(request, trade, "trade.offer_updated", payload)
            return Response(payload)

        return run_trade_action(request, campaign_id, request_id, unlock)


class CampaignTradeRequestCloseView(TradeWriteView):
    def post(self, request, campaign_id, request_id):
        def close_trade(trade: TradeRequest, side: str) -> Response:
            close(trade, side)
            payload = serialize_trade_request(trade)
            _broadcast(request, trade, "trade.closed", payload)
            return Response(payload)

        return run_trade_action(request, campaign_id, request_id, close_trade)
