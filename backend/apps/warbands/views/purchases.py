"""Buying items on the server (BUG-07; decisions 1, 2, 9 and 11)."""

from typing import Any

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.items.models import Item
from apps.warbands.serializers import WarbandItemSummarySerializer, WarbandSummarySerializer, WarbandTradeSerializer
from apps.warbands.serializers.purchases import PurchaseSerializer
from apps.warbands.services.purchases import Purchase, purchase
from apps.warbands.services.stash import stash_entry
from apps.warbands.services.unit_items import unit_item_rows
from apps.warbands.units.catalogue_scope import in_campaign_scope
from apps.warbands.units.errors import RosterError, validation_error
from apps.warbands.units.serializers import detail_item_entries

from .base import WarbandScopedView


def scoped_item(warband: Any, item_id: int) -> Item:
    """The item if the warband's campaign may use it (SEC-07); another campaign's answers as an unknown one."""
    items = Item.objects.filter(id=item_id).prefetch_related("availabilities")
    item = in_campaign_scope(items, warband.campaign_id).first()
    if item is None:
        raise RosterError("Item not found.", "not_found", {"item_id": ["Item not found."]}, status_code=404)
    return item


def purchase_answer(warband: Any, item: Item, bought: Purchase) -> dict[str, Any]:
    """The slim answer (ECON-PERF-03): the touched unit's items or the stash entry, the "Buy" row, the summary."""
    line = bought.line
    unit = line.unit
    stash = stash_entry(warband.id, item) if unit is None else None
    return {
        "target_type": line.target_type,
        "target_id": unit.pk if unit is not None else None,
        "items": detail_item_entries(unit_item_rows(line.target_type, unit)) if unit is not None else None,
        "stash_item": WarbandItemSummarySerializer(stash).data if stash else None,
        "trade": WarbandTradeSerializer(bought.trade).data if bought.trade else None,
        "summary": WarbandSummarySerializer(warband).data,
        "warnings": bought.warnings,
    }


class WarbandPurchaseView(WarbandScopedView):
    """POST purchases/: buy (or give) copies of an item to the stash or a unit, in one transaction."""

    def post(self, request: Request, warband_id: int) -> Response:
        body = PurchaseSerializer(data=request.data)
        if not body.is_valid():
            raise validation_error(body.errors)
        item = scoped_item(self.warband, body.validated_data["item_id"])
        bought = purchase(self.warband, item, body.validated_data)
        return Response(purchase_answer(self.warband, item, bought), status=status.HTTP_201_CREATED)
