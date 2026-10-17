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
from apps.warbands.services.item_moves import Outcome, add_to_stash, sell_item, transfer_item

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

        item = Item.objects.filter(id=item_id).first()
        if not item:
            return Response({"detail": "Item not found"}, status=404)
        warband_item = add_to_stash(self.warband, item, quantity, cost)
        return Response(WarbandItemSummarySerializer(warband_item).data, status=status.HTTP_201_CREATED)


class WarbandItemDetailView(WarbandScopedView):
    def delete(self, request: Request, warband_id: int, item_id: int) -> Response:
        warband_item = WarbandItem.objects.filter(warband=self.warband, item_id=item_id).first()
        if not warband_item:
            return Response({"detail": "Item not found in stash"}, status=404)

        qty = max(1, _int_or(request.data.get("quantity", 1), 1))
        new_quantity = (warband_item.quantity or 1) - qty
        if new_quantity <= 0:
            warband_item.delete()
        else:
            warband_item.quantity = new_quantity
            warband_item.save(update_fields=["quantity"])

        return Response(status=status.HTTP_204_NO_CONTENT)


def _item_response(move: Any, warband: Any, data: dict[str, Any]) -> Response:
    """Run a transfer or sale for an existing item; too few copies to move is a 400."""
    item = Item.objects.filter(id=data["item_id"]).first()
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
        return _item_response(transfer_item, self.warband, serializer.validated_data)


class WarbandItemSaleView(WarbandScopedView):
    def post(self, request: Request, warband_id: int) -> Response:
        serializer = WarbandItemSaleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return _item_response(sell_item, self.warband, serializer.validated_data)
