"""Buying items on the server (BUG-07; decisions 1, 2, 9 and 11)."""

from typing import Any

from django.db import transaction
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.items.models import Item
from apps.warbands.serializers import WarbandItemSummarySerializer, WarbandSummarySerializer, WarbandTradeSerializer
from apps.warbands.serializers.purchases import PurchaseSerializer, RarityRollRequestSerializer
from apps.warbands.services.purchases import Purchase, purchase
from apps.warbands.services.rarity_rolls import RollRefused, record_roll
from apps.warbands.services.stash import stash_entry
from apps.warbands.services.summary import load_warband_units
from apps.warbands.services.unit_items import unit_item_rows
from apps.warbands.units.catalogue_scope import current_entry, shop_items
from apps.warbands.units.companions import companion_fields
from apps.warbands.units.errors import RosterError, validation_error
from apps.warbands.units.kinds import HENCHMEN_GROUP
from apps.warbands.units.serializers import detail_item_entries
from apps.warbands.units.services.beasts import size_warnings

from .base import WarbandScopedView
from .beasts import unit_detail


def scoped_item(warband: Any, item_id: int) -> Item:
    """The campaign's current item for `item_id` (its version of a book item, CAT-TWEAK-03) if the warband's campaign
    may use it (SEC-07); another campaign's answers as an unknown one."""
    item: Item | None = current_entry(shop_items(warband.campaign_id), item_id, warband.campaign_id)
    if item is None:
        raise RosterError("Item not found.", "not_found", {"item_id": ["Item not found."]}, status_code=404)
    return item


def purchase_answer(warband: Any, item: Item, bought: Purchase) -> dict[str, Any]:
    """The slim answer (ECON-PERF-03): the touched unit's items with its mount, pets and mounted stats, or the stash
    entry, or the group a creature was recruited into; the "Buy" row, the summary."""
    line = bought.line
    unit = line.unit
    rows = unit_item_rows(line.target_type, unit) if unit is not None else []
    stash = stash_entry(warband.id, item) if unit is None and line.group is None else None
    group = unit_detail(HENCHMEN_GROUP.key, line.group.pk) if line.group is not None else None
    units = load_warband_units([warband.id])[warband.id]
    return {
        "target_type": line.target_type,
        "target_id": unit.pk if unit is not None else None,
        "updated_at": serializers.DateTimeField().to_representation(unit.updated_at) if unit is not None else None,
        "items": detail_item_entries(rows) if unit is not None else None,
        **companion_fields(unit, rows),
        "group": group,
        "stash_item": WarbandItemSummarySerializer(stash).data if stash else None,
        "trade": WarbandTradeSerializer(bought.trade).data if bought.trade else None,
        "summary": WarbandSummarySerializer(warband, context={"warband_units": units}).data,
        "warnings": bought.warnings + (size_warnings(warband, group, units) if group else []),
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


class WarbandRarityRollView(WarbandScopedView):
    """POST rarity-rolls/: save a rarity roll that ended without a purchase (decision 9). The searching hero spends
    his trading action, or is warned that he already had."""

    def post(self, request: Request, warband_id: int) -> Response:
        body = RarityRollRequestSerializer(data=request.data)
        if not body.is_valid():
            raise validation_error(body.errors)
        item = scoped_item(self.warband, body.validated_data["item_id"])
        try:
            with transaction.atomic():
                warnings = record_roll(self.warband, item, body.validated_data)
        except RollRefused as refusal:
            raise RosterError(str(refusal), "invalid", {"hero_id": [str(refusal)]}) from None
        answer = {"hero_id": body.validated_data["hero_id"], "trading_action": False, "warnings": warnings}
        return Response(answer, status=status.HTTP_201_CREATED)
