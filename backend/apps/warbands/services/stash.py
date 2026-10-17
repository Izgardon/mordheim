"""A warband's stash stock, changed without lost updates (BUG-36).

Copies are added with one `F("quantity") + n` UPDATE; a first insert that races another request's falls back
to that increment instead of breaking `unique_warband_item`. Copies are taken out of a row locked with
`select_for_update` (its cost and the answer need it) by a `quantity__gte`-guarded UPDATE, or by deleting
the row with its last copy, so two requests can't both take the last copy. Call `remove_from_stash` inside
a transaction: the row lock lasts until it commits. Discards (`discard_from_stash`) need no cost or answer,
so they are two guarded statements without a lock.
"""

from dataclasses import dataclass

from django.db import IntegrityError, transaction
from django.db.models import F

from apps.items.models import Item
from apps.warbands.models import Warband, WarbandItem


class StashShortage(ValueError):
    """The stash holds fewer copies than asked for; nothing was taken."""


@dataclass(frozen=True)
class StashTake:
    cost: int | None  # the row's cost: the stash keeps one cost per item
    remaining: WarbandItem | None  # the row left (its item loaded), or None when the last copy went


def add_to_stash(warband_id: int, item_id: int, quantity: int, cost: int | None) -> WarbandItem | None:
    """Add `quantity` copies; a cost, when given, becomes the row's. Returns the row if this created it."""
    if quantity <= 0:
        return None
    changes: dict[str, object] = {"quantity": F("quantity") + quantity}
    if cost is not None:
        changes["cost"] = cost
    rows = WarbandItem.objects.filter(warband_id=warband_id, item_id=item_id)
    if rows.update(**changes):
        return None
    try:
        with transaction.atomic():  # a savepoint, so a lost race leaves the caller's transaction usable
            return WarbandItem.objects.create(warband_id=warband_id, item_id=item_id, quantity=quantity, cost=cost)
    except IntegrityError:  # another request inserted the row first: add to it instead
        rows.update(**changes)
        return None


def remove_from_stash(warband_id: int, item_id: int, quantity: int) -> StashTake:
    """Take `quantity` copies out; StashShortage when the stash holds fewer."""
    row = (
        WarbandItem.objects.select_for_update(of=("self",))
        .select_related("item")
        .filter(warband_id=warband_id, item_id=item_id)
        .first()
    )
    if row is None or row.quantity < quantity:
        raise StashShortage("Item not found in stash.")
    cost = row.cost
    if row.quantity <= quantity:
        row.delete()
        return StashTake(cost, None)
    WarbandItem.objects.filter(pk=row.pk, quantity__gte=quantity).update(quantity=F("quantity") - quantity)
    row.quantity -= quantity
    return StashTake(cost, row)


def discard_from_stash(warband_id: int, item_id: int, quantity: int) -> bool:
    """DELETE items/: take up to `quantity` copies out, emptying the row if it holds no more; False if none.

    Two guarded statements, no lock: a copy added between them only turns this into a "not found".
    """
    rows = WarbandItem.objects.filter(warband_id=warband_id, item_id=item_id)
    if rows.filter(quantity__gt=quantity).update(quantity=F("quantity") - quantity):
        return True
    deleted, _ = rows.filter(quantity__lte=quantity).delete()
    return bool(deleted)


def stash_row(warband_id: int, item: Item) -> WarbandItem:
    """The stash row for `item` as stored now, for an answer."""
    row = WarbandItem.objects.get(warband_id=warband_id, item_id=item.id)
    row.item = item
    return row


def stock_item(warband: Warband, item: Item, quantity: int, cost: int | None) -> WarbandItem:
    """POST items/: add copies to the stash; an item with one availability defaults to its cost."""
    if cost is None:
        availabilities = list(item.availabilities.all())
        if len(availabilities) == 1:
            cost = availabilities[0].cost
    created = add_to_stash(warband.id, item.id, quantity, cost)
    if created is None:
        return stash_row(warband.id, item)
    created.item = item
    return created
