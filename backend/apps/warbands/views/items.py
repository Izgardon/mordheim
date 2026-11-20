"""The warband's stash, and moving or selling items between units and the stash."""

from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from apps.items.models import Item
from apps.warbands.serializers import (
    WarbandItemSaleSerializer,
    WarbandItemSummarySerializer,
    WarbandItemTransferSerializer,
)
from apps.warbands.services.item_moves import Outcome, sell_item, transfer_item
from apps.warbands.services.stash import stash_entries
from apps.warbands.units.catalogue_scope import current_entry

from .base import WarbandScopedView


class WarbandItemListView(WarbandScopedView):
    def get(self, request: Request, warband_id: int) -> Response:
        return Response(WarbandItemSummarySerializer(stash_entries(self.warband), many=True).data)


def _item_response(move: Any, warband: Any, data: dict[str, Any], *, scoped: bool) -> Response:
    """Run a transfer or sale for an existing item; too few copies to move is a 400. A `scoped` move (a
    transfer) only takes the campaign's own or global items (SEC-07); a copy of another campaign's item
    already held can still be sold."""
    if scoped:
        item = current_entry(Item.objects.select_related("bestiary_entry"), data["item_id"], warband.campaign_id)
    else:
        item = Item.objects.select_related("bestiary_entry").filter(id=data["item_id"]).first()
    if not item:
        return Response({"detail": "Item not found"}, status=404)
    try:
        outcome: Outcome = move(warband, item, {**data, "item_id": item.id})  # the version a book id stands for
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
