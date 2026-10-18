"""The warband's stash, and moving or selling items between units and the stash."""

from typing import Any

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.items.models import Item
from apps.warbands.models import WarbandItem
from apps.warbands.serializers import (
    WarbandItemSaleSerializer,
    WarbandItemSummarySerializer,
    WarbandItemTransferSerializer,
)
from apps.warbands.services.item_moves import Outcome, sell_item, transfer_item
from apps.warbands.services.stash import discard_from_stash, stock_item
from apps.warbands.units.catalogue_scope import in_campaign_scope

from .base import WarbandScopedView


def _int_or(value: Any, default: Any) -> Any:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


class WarbandItemListView(WarbandScopedView):
    def get(self, request: Request, warband_id: int) -> Response:
        items = (
            WarbandItem.objects.filter(warband=self.warband).select_related("item").order_by("item__name", "item__id")
        )
        return Response(WarbandItemSummarySerializer(items, many=True).data)

    def post(self, request: Request, warband_id: int) -> Response:
        item_id = _int_or(request.data.get("item_id"), None)
        if item_id is None:
            return Response({"detail": "Invalid item id"}, status=400)
        quantity = max(1, _int_or(request.data.get("quantity", 1), 1))
        cost = request.data.get("cost")
        if cost is not None:
            cost = _int_or(cost, None)

        # another campaign's item answers as one that doesn't exist (SEC-07)
        item = in_campaign_scope(Item.objects.filter(id=item_id), self.warband.campaign_id).first()
        if not item:
            return Response({"detail": "Item not found"}, status=404)
        warband_item = stock_item(self.warband, item, quantity, cost)
        return Response(WarbandItemSummarySerializer(warband_item).data, status=status.HTTP_201_CREATED)


class WarbandItemDetailView(WarbandScopedView):
    def delete(self, request: Request, warband_id: int, item_id: int) -> Response:
        qty = max(1, _int_or(request.data.get("quantity", 1), 1))
        if not discard_from_stash(self.warband, item_id, qty):  # more copies than held empties the row
            return Response({"detail": "Item not found in stash"}, status=404)
        return Response(status=status.HTTP_204_NO_CONTENT)


def _item_response(move: Any, warband: Any, data: dict[str, Any], *, scoped: bool) -> Response:
    """Run a transfer or sale for an existing item; too few copies to move is a 400. A `scoped` move (a
    transfer) only takes the campaign's own or global items (SEC-07); a copy of another campaign's item
    already held can still be sold."""
    items = Item.objects.filter(id=data["item_id"])
    item = (in_campaign_scope(items, warband.campaign_id) if scoped else items).first()
    if not item:
        return Response({"detail": "Item not found"}, status=404)
    try:
        outcome: Outcome = move(warband, item, data)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=400)
    status_code, body = outcome
    return Response(body, status=status_code)


class WarbandItemTransferView(WarbandScopedView):
    def post(self, request: Request, warband_id: int) -> Response:
        serializer = WarbandItemTransferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return _item_response(transfer_item, self.warband, serializer.validated_data, scoped=True)


class WarbandItemSaleView(WarbandScopedView):
    def post(self, request: Request, warband_id: int) -> Response:
        serializer = WarbandItemSaleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return _item_response(sell_item, self.warband, serializer.validated_data, scoped=False)
