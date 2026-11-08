"""Resource counters (wyrdstone shards, treasure, ...): changed in the database and never below 0 (BUG-68)."""

from django.db import transaction
from django.db.models import BigIntegerField, F, Value
from django.db.models.functions import Cast, Greatest, Least

from apps.warbands.models import LedgerAction, Warband, WarbandResource, WarbandTrade
from apps.warbands.services import economy_log, ledger
from apps.warbands.services.campaign_points import resource_rows

MAX_AMOUNT = 2_147_483_647  # WarbandResource.amount is a 32-bit integer column


class ResourceShortage(ValueError):
    """The resource holds less than the sale takes; nothing was sold."""


def change_resource(
    warband: Warband,
    resource_id: int,
    *,
    amount: int | None = None,
    delta: int | None = None,
    name: str | None = None,
) -> WarbandResource | None:
    """Set the amount, or add `delta` to the stored amount (a concurrent change isn't lost), stopping at 0 and at
    the column's limit, and rename it when `name` is given. None when the warband has no such resource (or it is
    campaign points its campaign has off)."""
    rows = resource_rows(warband).filter(id=resource_id)
    if name is not None and not rows.update(name=name):
        return None
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
    the player gave) and its log line ("Sold 3 Wyrdstone for 65 gc") in one transaction. None when there is no
    such resource; ResourceShortage when it holds less than `quantity`."""
    rows = resource_rows(warband).filter(id=resource_id)
    name = rows.values_list("name", flat=True).first()
    if name is None:
        return None
    with transaction.atomic():
        # the gold first: it locks the warband before the resource row, as postbattle does
        description = f"{name} x {quantity}" if quantity > 1 else name
        trade = ledger.record(warband, LedgerAction.SELL, price, description)
        if not rows.filter(amount__gte=quantity).update(amount=F("amount") - quantity):
            raise ResourceShortage(f"Not enough {name} to sell.")  # rolls the gold back
        resource = rows.get()  # after the guarded UPDATE, which keeps the row locked until commit
        economy_log.log_resource_sale(warband, name, quantity, price)
    return resource, trade
