"""Resource counters (wyrdstone shards, treasure, ...): changed in the database and never below 0 (BUG-68)."""

from django.db import transaction
from django.db.models import BigIntegerField, F, Value
from django.db.models.functions import Cast, Greatest, Least

from apps.warbands.models import Warband, WarbandResource, WarbandTrade
from apps.warbands.utils.trades import TradeHelper

MAX_AMOUNT = 2_147_483_647  # WarbandResource.amount is a 32-bit integer column


class ResourceShortage(ValueError):
    """The resource holds less than the sale takes; nothing was sold."""


def change_resource(
    warband: Warband, resource_id: int, *, amount: int | None = None, delta: int | None = None
) -> WarbandResource | None:
    """Set the amount, or add `delta` to the stored amount (a concurrent change isn't lost), stopping at 0 and at
    the column's limit. None when the warband has no such resource."""
    rows = WarbandResource.objects.filter(id=resource_id, warband=warband)
    if delta is not None:
        widened = Cast(F("amount"), output_field=BigIntegerField()) + Value(delta, output_field=BigIntegerField())
        floor = Greatest(widened, Value(0, output_field=BigIntegerField()))
        new_amount: object = Least(floor, Value(MAX_AMOUNT, output_field=BigIntegerField()))
    else:
        new_amount = amount
    if new_amount is not None and not rows.update(amount=new_amount):
        return None
    return rows.first()


def sell_resource(
    warband: Warband, resource_id: int, quantity: int, price: int
) -> tuple[WarbandResource, WarbandTrade] | None:
    """POST resources/<id>/sell/: take `quantity` off the resource and write its "Sell" ledger row (the price
    the player gave) in one transaction. None when there is no such resource; ResourceShortage when it holds
    less than `quantity`."""
    rows = WarbandResource.objects.filter(id=resource_id, warband=warband)
    with transaction.atomic():
        taken = rows.filter(amount__gte=quantity).update(amount=F("amount") - quantity)
        resource = rows.first()  # after the guarded UPDATE, which keeps the row locked until commit
        if resource is None:
            return None
        if not taken:
            raise ResourceShortage(f"Not enough {resource.name} to sell.")
        description = f"{resource.name} x {quantity}" if quantity > 1 else resource.name
        trade = TradeHelper.create_trade(warband=warband, action="Sell", description=description, price=price)
    return resource, trade
