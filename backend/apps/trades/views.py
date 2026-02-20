from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.models import CampaignMembership
from apps.campaigns.permissions import get_membership
from apps.realtime.services import (
    send_trade_event,
    send_user_notification,
    serialize_trade_request,
)
from apps.warbands.models import Warband, WarbandItem, WarbandTrade, Hero
from .models import TradeRequest

EXPENSE_ACTIONS = {
    "buy",
    "bought",
    "recruit",
    "recruited",
    "hired",
    "hire",
    "upkeep",
    "trade sent",
}


def _calculate_trade_total(warband_id: int) -> int:
    total = 0
    for trade in WarbandTrade.objects.filter(warband_id=warband_id):
        price = trade.price or 0
        action = (trade.action or "").strip().lower()
        if action in EXPENSE_ACTIONS:
            total -= abs(price)
        else:
            total += abs(price)
    return max(total, 0)


def _normalize_offer_items(items, warband_id: int):
    normalized = []
    if not isinstance(items, list):
        return normalized

    requested = {}
    for entry in items:
        if not isinstance(entry, dict):
            continue
        item_id = entry.get("id")
        qty = entry.get("quantity", 0)
        try:
            item_id = int(item_id)
            qty = int(qty)
        except (TypeError, ValueError):
            continue
        if item_id <= 0 or qty <= 0:
            continue
        requested[item_id] = requested.get(item_id, 0) + qty

    if not requested:
        return normalized

    warband_items = (
        WarbandItem.objects.select_related("item")
        .filter(warband_id=warband_id, item_id__in=requested.keys())
    )
    available = {entry.item_id: entry.quantity for entry in warband_items}
    names = {entry.item_id: entry.item.name for entry in warband_items}
    costs = {entry.item_id: entry.item.cost for entry in warband_items}

    for item_id, qty in requested.items():
        if item_id not in available:
            raise ValueError("One or more items are not in the warchest.")
        if qty > available[item_id]:
            raise ValueError("Not enough quantity for one or more items.")
        normalized.append(
            {
                "id": item_id,
                "name": names[item_id],
                "quantity": qty,
                "cost": costs.get(item_id, 0),
            }
        )

    return normalized


def _build_offer_payload(payload, warband_id: int):
    data = payload if isinstance(payload, dict) else {}
    trader_id = data.get("trader_id", None)
    trader_name = None
    if trader_id is not None and trader_id != "":
        try:
            trader_id = int(trader_id)
        except (TypeError, ValueError):
            trader_id = None
    else:
        trader_id = None
    if trader_id is not None:
        hero = Hero.objects.filter(id=trader_id, warband_id=warband_id).first()
        if not hero:
            raise ValueError("Trader not found.")
        trader_name = hero.name or f"Hero {hero.id}"

    gold = data.get("gold", 0)
    try:
        gold = int(gold)
    except (TypeError, ValueError):
        gold = 0
    gold = max(0, gold)

    max_gold = _calculate_trade_total(warband_id)
    if gold > max_gold:
        raise ValueError("Not enough gold.")

    items = _normalize_offer_items(data.get("items", []), warband_id)

    return {
        "trader_id": trader_id,
        "trader_name": trader_name,
        "gold": gold,
        "items": items,
    }


def _get_offer_data(trade_request, side: str):
    return trade_request.from_offer if side == "from" else trade_request.to_offer


def _set_offer_data(trade_request, side: str, offer: dict):
    if side == "from":
        trade_request.from_offer = offer
    else:
        trade_request.to_offer = offer


def _transfer_items(source_warband_id: int, target_warband_id: int, items: list[dict]) -> None:
    for entry in items:
        item_id = int(entry.get("id"))
        qty = int(entry.get("quantity", 0))
        if qty <= 0:
            continue

        source_item = (
            WarbandItem.objects.select_for_update()
            .filter(warband_id=source_warband_id, item_id=item_id)
            .first()
        )
        if not source_item or source_item.quantity < qty:
            raise ValueError("Insufficient item quantity for trade.")

        source_item.quantity -= qty
        if source_item.quantity <= 0:
            source_item.delete()
        else:
            source_item.save(update_fields=["quantity"])

        target_item = (
            WarbandItem.objects.select_for_update()
            .filter(warband_id=target_warband_id, item_id=item_id)
            .first()
        )
        if target_item:
            target_item.quantity += qty
            target_item.save(update_fields=["quantity"])
        else:
            WarbandItem.objects.create(
                warband_id=target_warband_id,
                item_id=item_id,
                quantity=qty,
            )


def _apply_trade_transfer(trade_request: TradeRequest):
    from_offer = _build_offer_payload(trade_request.from_offer, trade_request.from_warband_id)
    to_offer = _build_offer_payload(trade_request.to_offer, trade_request.to_warband_id)

    trade_request.from_offer = from_offer
    trade_request.to_offer = to_offer

    _transfer_items(trade_request.from_warband_id, trade_request.to_warband_id, from_offer["items"])
    _transfer_items(trade_request.to_warband_id, trade_request.from_warband_id, to_offer["items"])

    from_gold = from_offer.get("gold", 0)
    if from_gold:
        WarbandTrade.objects.create(
            warband_id=trade_request.from_warband_id,
            action="Trade sent",
            description=f"Gold sent to {trade_request.to_warband.name}",
            price=int(from_gold),
        )
        WarbandTrade.objects.create(
            warband_id=trade_request.to_warband_id,
            action="Trade received",
            description=f"Gold received from {trade_request.from_warband.name}",
            price=int(from_gold),
        )

    to_gold = to_offer.get("gold", 0)
    if to_gold:
        WarbandTrade.objects.create(
            warband_id=trade_request.to_warband_id,
            action="Trade sent",
            description=f"Gold sent to {trade_request.from_warband.name}",
            price=int(to_gold),
        )
        WarbandTrade.objects.create(
            warband_id=trade_request.from_warband_id,
            action="Trade received",
            description=f"Gold received from {trade_request.to_warband.name}",
            price=int(to_gold),
        )


class UserPendingTradeRequestListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        base_qs = TradeRequest.objects.select_related(
            "from_user",
            "to_user",
            "from_warband",
            "to_warband",
        ).filter(to_user=request.user, status=TradeRequest.STATUS_PENDING)

        expired_ids = list(base_qs.filter(expires_at__lte=now).values_list("id", flat=True))
        if expired_ids:
            TradeRequest.objects.filter(id__in=expired_ids).update(
                status=TradeRequest.STATUS_EXPIRED,
                responded_at=now,
            )

        requests = base_qs.filter(expires_at__gt=now).order_by("-created_at")
        payload = [serialize_trade_request(entry) for entry in requests]
        return Response(payload)


class CampaignTradeRequestListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        status_filter = request.query_params.get("status")
        if status_filter:
            valid_statuses = {
                TradeRequest.STATUS_PENDING,
                TradeRequest.STATUS_ACCEPTED,
                TradeRequest.STATUS_DECLINED,
                TradeRequest.STATUS_EXPIRED,
                TradeRequest.STATUS_COMPLETED,
            }
            if status_filter not in valid_statuses:
                return Response({"detail": "Invalid status"}, status=400)

        queryset = TradeRequest.objects.select_related(
            "from_user",
            "to_user",
            "from_warband",
            "to_warband",
        ).filter(campaign_id=campaign_id)

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        queryset = queryset.order_by("-responded_at", "-created_at")
        payload = [serialize_trade_request(entry) for entry in queryset]
        return Response(payload)

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

        target_membership = CampaignMembership.objects.filter(
            campaign_id=campaign_id, user_id=target_user_id
        ).first()
        if not target_membership:
            return Response({"detail": "Player not found"}, status=404)

        from_warband = Warband.objects.filter(
            campaign_id=campaign_id, user_id=request.user.id
        ).first()
        to_warband = Warband.objects.filter(
            campaign_id=campaign_id, user_id=target_user_id
        ).first()

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

        trade_request = TradeRequest.objects.select_related(
            "from_user",
            "to_user",
            "from_warband",
            "to_warband",
        ).get(id=trade_request.id)
        payload = serialize_trade_request(trade_request)
        send_user_notification(target_user_id, "trade_request", payload)

        return Response(payload, status=status.HTTP_201_CREATED)


class CampaignTradeOfferUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id, request_id):
        trade_request = (
            TradeRequest.objects.select_related(
                "from_user",
                "to_user",
                "from_warband",
                "to_warband",
            )
            .filter(id=request_id, campaign_id=campaign_id)
            .first()
        )
        if not trade_request:
            return Response({"detail": "Not found"}, status=404)

        if request.user.id not in (trade_request.from_user_id, trade_request.to_user_id):
            return Response({"detail": "Forbidden"}, status=403)

        if trade_request.expires_at <= timezone.now():
            trade_request.status = TradeRequest.STATUS_EXPIRED
            trade_request.responded_at = timezone.now()
            trade_request.save(update_fields=["status", "responded_at"])
            return Response({"detail": "Trade request expired"}, status=400)

        if trade_request.status != TradeRequest.STATUS_ACCEPTED:
            return Response({"detail": "Trade is not active"}, status=400)

        side = "from" if request.user.id == trade_request.from_user_id else "to"
        warband_id = (
            trade_request.from_warband_id
            if side == "from"
            else trade_request.to_warband_id
        )

        try:
            offer = _build_offer_payload(request.data, warband_id)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

        _set_offer_data(trade_request, side, offer)
        trade_request.from_accepted = False
        trade_request.to_accepted = False
        trade_request.save(update_fields=["from_offer", "to_offer", "from_accepted", "to_accepted"])

        payload = serialize_trade_request(trade_request)
        send_trade_event(trade_request.id, "trade.offer_updated", payload)
        return Response(payload)


class CampaignTradeRequestDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id, request_id):
        trade_request = (
            TradeRequest.objects.select_related(
                "from_user",
                "to_user",
                "from_warband",
                "to_warband",
            )
            .filter(id=request_id, campaign_id=campaign_id)
            .first()
        )
        if not trade_request:
            return Response({"detail": "Not found"}, status=404)

        if request.user.id not in (trade_request.from_user_id, trade_request.to_user_id):
            return Response({"detail": "Not found"}, status=404)

        if trade_request.expires_at <= timezone.now() and trade_request.status == TradeRequest.STATUS_PENDING:
            trade_request.status = TradeRequest.STATUS_EXPIRED
            trade_request.responded_at = timezone.now()
            trade_request.save(update_fields=["status", "responded_at"])

        return Response(serialize_trade_request(trade_request))


class CampaignTradeRequestAcceptView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id, request_id):
        trade_request = (
            TradeRequest.objects.select_related(
                "from_user",
                "to_user",
                "from_warband",
                "to_warband",
            )
            .filter(id=request_id, campaign_id=campaign_id)
            .first()
        )
        if not trade_request:
            return Response({"detail": "Not found"}, status=404)

        if request.user.id != trade_request.to_user_id:
            return Response({"detail": "Forbidden"}, status=403)

        if trade_request.expires_at <= timezone.now():
            trade_request.status = TradeRequest.STATUS_EXPIRED
            trade_request.responded_at = timezone.now()
            trade_request.save(update_fields=["status", "responded_at"])
            return Response({"detail": "Trade request expired"}, status=400)

        if trade_request.status != TradeRequest.STATUS_PENDING:
            return Response({"detail": "Trade request is no longer pending"}, status=400)

        trade_request.status = TradeRequest.STATUS_ACCEPTED
        trade_request.responded_at = timezone.now()
        trade_request.save(update_fields=["status", "responded_at"])

        payload = serialize_trade_request(trade_request)
        send_trade_event(trade_request.id, "trade.accepted", payload)
        send_user_notification(trade_request.from_user_id, "trade_accepted", payload)

        return Response(payload)


class CampaignTradeOfferAcceptView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id, request_id):
        trade_request = (
            TradeRequest.objects.select_related(
                "from_user",
                "to_user",
                "from_warband",
                "to_warband",
            )
            .filter(id=request_id, campaign_id=campaign_id)
            .first()
        )
        if not trade_request:
            return Response({"detail": "Not found"}, status=404)

        if request.user.id not in (trade_request.from_user_id, trade_request.to_user_id):
            return Response({"detail": "Forbidden"}, status=403)

        if trade_request.expires_at <= timezone.now():
            trade_request.status = TradeRequest.STATUS_EXPIRED
            trade_request.responded_at = timezone.now()
            trade_request.save(update_fields=["status", "responded_at"])
            return Response({"detail": "Trade request expired"}, status=400)

        if trade_request.status != TradeRequest.STATUS_ACCEPTED:
            return Response({"detail": "Trade is not active"}, status=400)

        if request.user.id == trade_request.from_user_id:
            trade_request.from_accepted = True
        else:
            trade_request.to_accepted = True
        trade_request.save(update_fields=["from_accepted", "to_accepted"])

        payload = serialize_trade_request(trade_request)
        send_trade_event(trade_request.id, "trade.locked", payload)

        if trade_request.from_accepted and trade_request.to_accepted:
            try:
                with transaction.atomic():
                    locked = (
                        TradeRequest.objects.select_for_update()
                        .select_related(
                            "from_user",
                            "to_user",
                            "from_warband",
                            "to_warband",
                        )
                        .get(id=trade_request.id)
                    )
                    if locked.status != TradeRequest.STATUS_ACCEPTED:
                        return Response({"detail": "Trade is no longer active"}, status=400)
                    if not (locked.from_accepted and locked.to_accepted):
                        return Response(serialize_trade_request(locked))

                    _apply_trade_transfer(locked)
                    locked.status = TradeRequest.STATUS_COMPLETED
                    locked.responded_at = timezone.now()
                    locked.save(update_fields=["status", "responded_at", "from_offer", "to_offer"])
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=400)

            payload = serialize_trade_request(locked)
            send_trade_event(trade_request.id, "trade.completed", payload)
            return Response(payload)

        return Response(payload)


class CampaignTradeRequestDeclineView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id, request_id):
        trade_request = (
            TradeRequest.objects.select_related(
                "from_user",
                "to_user",
                "from_warband",
                "to_warband",
            )
            .filter(id=request_id, campaign_id=campaign_id)
            .first()
        )
        if not trade_request:
            return Response({"detail": "Not found"}, status=404)

        if request.user.id != trade_request.to_user_id:
            return Response({"detail": "Forbidden"}, status=403)

        if trade_request.expires_at <= timezone.now():
            trade_request.status = TradeRequest.STATUS_EXPIRED
            trade_request.responded_at = timezone.now()
            trade_request.save(update_fields=["status", "responded_at"])
            return Response({"detail": "Trade request expired"}, status=400)

        if trade_request.status != TradeRequest.STATUS_PENDING:
            return Response({"detail": "Trade request is no longer pending"}, status=400)

        trade_request.status = TradeRequest.STATUS_DECLINED
        trade_request.responded_at = timezone.now()
        trade_request.save(update_fields=["status", "responded_at"])

        payload = serialize_trade_request(trade_request)
        send_user_notification(trade_request.from_user_id, "trade_declined", payload)

        return Response(payload)


class CampaignTradeRequestCloseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id, request_id):
        trade_request = (
            TradeRequest.objects.select_related(
                "from_user",
                "to_user",
                "from_warband",
                "to_warband",
            )
            .filter(id=request_id, campaign_id=campaign_id)
            .first()
        )
        if not trade_request:
            return Response({"detail": "Not found"}, status=404)

        if request.user.id not in (trade_request.from_user_id, trade_request.to_user_id):
            return Response({"detail": "Forbidden"}, status=403)

        if trade_request.status in (
            TradeRequest.STATUS_DECLINED,
            TradeRequest.STATUS_EXPIRED,
            TradeRequest.STATUS_COMPLETED,
        ):
            return Response({"detail": "Trade request is no longer active"}, status=400)

        if trade_request.expires_at <= timezone.now():
            trade_request.status = TradeRequest.STATUS_EXPIRED
            trade_request.responded_at = timezone.now()
            trade_request.save(update_fields=["status", "responded_at"])
            return Response({"detail": "Trade request expired"}, status=400)

        trade_request.status = TradeRequest.STATUS_DECLINED
        trade_request.responded_at = timezone.now()
        trade_request.save(update_fields=["status", "responded_at"])

        payload = serialize_trade_request(trade_request)
        send_trade_event(trade_request.id, "trade.closed", payload)

        return Response(payload)
