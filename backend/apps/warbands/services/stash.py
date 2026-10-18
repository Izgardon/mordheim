"""A warband's stash stock: each copy keeps the cost it came with (BUG-117), changed without lost updates (BUG-36).

The stash holds one row per item and cost (`unique_warband_item_cost`, an unknown cost counting as one cost), so
copies that cost 10 and 12 are two rows and nothing is re-priced. Copies are added to their cost's row with one
`F("quantity") + n` UPDATE; a first insert that races another request's falls back to that increment. Copies
are taken from the item's rows locked with `select_for_update`, the most recently started row first (or only
the rows of one cost), by guarded UPDATEs or by deleting a row with its last copy, so two requests can't both
take the last copy. Call `remove_from_stash` inside a transaction: the locks last until it commits. A discard
(`discard_from_stash`) locks the same way, in its own transaction with its log entry (ECON-CQ-02).

Answers show one entry per item (`StashEntry`): the total, the cost of the copies that would leave first, and
each cost's count.
"""

from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass, field

from django.db import IntegrityError, transaction
from django.db.models import F, Q, QuerySet

from apps.items.models import Item
from apps.warbands.models import Warband, WarbandItem
from apps.warbands.services import economy_log
from apps.warbands.services.prices import annotated_current, house_rule_prices, own_price_of

ANY_COST = object()  # remove_from_stash takes copies of every cost unless one is named


class StashShortage(ValueError):
    """The stash holds fewer copies than asked for (`held`, 0 without any); nothing was taken."""

    def __init__(self, message: str, held: int = 0) -> None:
        super().__init__(message)
        self.held = held


@dataclass(frozen=True)
class CostCount:
    cost: int | None
    quantity: int


@dataclass(frozen=True)
class StashEntry:
    """One item in the stash, as answers show it."""

    item: Item
    quantity: int
    cost: int | None  # the cost of the copies that leave first (the newest row's)
    costs: list[CostCount] = field(default_factory=list)  # newest row first
    current_price: int | None = None  # the item's current campaign price (services/prices.py)


@dataclass(frozen=True)
class StashTake:
    item: Item | None  # None when the stash held no copy
    costs: list[int | None]  # each copy taken, in the order taken
    remaining: StashEntry | None  # what is left of the item, or None when the last copy went


def _cost_filter(cost: int | None) -> Q:
    return Q(cost__isnull=True) if cost is None else Q(cost=cost)


def add_to_stash(warband_id: int, item_id: int, quantity: int, cost: int | None) -> None:
    """Add `quantity` copies at `cost` (None: unknown) to that cost's row."""
    if quantity <= 0:
        return
    rows = WarbandItem.objects.filter(_cost_filter(cost), warband_id=warband_id, item_id=item_id)
    if rows.update(quantity=F("quantity") + quantity):
        return
    try:
        with transaction.atomic():  # a savepoint, so a lost race leaves the caller's transaction usable
            WarbandItem.objects.create(warband_id=warband_id, item_id=item_id, quantity=quantity, cost=cost)
    except IntegrityError:  # another request inserted the row first: add to it instead
        rows.update(quantity=F("quantity") + quantity)


def add_costs(warband_id: int, item_id: int, costs: Iterable[int | None]) -> None:
    """Add one copy per cost in `costs` (one statement per distinct cost)."""
    for cost, quantity in Counter(costs).items():
        add_to_stash(warband_id, item_id, quantity, cost)


def _priced(rows: QuerySet[WarbandItem]) -> QuerySet[WarbandItem]:
    """Stash rows with their item's current campaign price read in the same query."""
    return rows.annotate(**house_rule_prices("warband__campaign_id", "item__name"), own_price=own_price_of("item_id"))


def _entry(item: Item, rows: list[WarbandItem]) -> StashEntry | None:
    current = annotated_current(rows[0], getattr(rows[0], "own_price", None)) if rows else None
    rows = [row for row in rows if row.quantity > 0]
    if not rows:
        return None
    costs = [CostCount(row.cost, row.quantity) for row in rows]
    return StashEntry(item, sum(row.quantity for row in rows), rows[0].cost, costs, current)


def remove_from_stash(
    warband_id: int, item_id: int, quantity: int, cost: object = ANY_COST, *, up_to: bool = False
) -> StashTake:
    """Take `quantity` copies out (of one cost when `cost` is given), newest row first. StashShortage when the
    stash holds fewer, unless `up_to`, which takes what there is."""
    rows = _priced(WarbandItem.objects.select_for_update(of=("self",)).select_related("item"))
    held_rows = list(rows.filter(warband_id=warband_id, item_id=item_id).order_by("-id"))
    takeable = held_rows if cost is ANY_COST else [row for row in held_rows if row.cost == cost]
    held = sum(row.quantity for row in takeable)
    if held < quantity and not up_to:
        raise StashShortage("Item not found in stash.", held=held)
    taken: list[int | None] = []
    for row in takeable:
        take = min(row.quantity, quantity - len(taken))
        if take <= 0:
            break
        if take == row.quantity:
            row.delete()
        else:
            WarbandItem.objects.filter(pk=row.pk, quantity__gte=take).update(quantity=F("quantity") - take)
        row.quantity -= take
        taken += [row.cost] * take
    item = held_rows[0].item if held_rows else None
    return StashTake(item, taken, _entry(item, held_rows) if item else None)


def discard_from_stash(warband: Warband, item_id: int, quantity: int) -> int:
    """DELETE items/: take up to `quantity` copies out, newest row first, and log what went; how many copies were
    discarded (0 when the stash has none)."""
    with transaction.atomic():
        take = remove_from_stash(warband.id, item_id, quantity, up_to=True)
        if take.item is not None and take.costs:
            economy_log.log_discard(warband, take.item.name, len(take.costs))
    return len(take.costs)


def stash_entry(warband_id: int, item: Item) -> StashEntry | None:
    """The item's stash entry as stored now, for an answer (None without copies)."""
    rows = list(_priced(WarbandItem.objects.filter(warband_id=warband_id, item_id=item.id)).order_by("-id"))
    return _entry(item, rows)


def stash_entries(warband: Warband) -> list[StashEntry]:
    """The whole stash, one entry per item, by item name (one query)."""
    rows = _priced(WarbandItem.objects.filter(warband=warband).select_related("item"))
    rows = rows.order_by("item__name", "item__id", "-id")
    grouped: dict[int, list[WarbandItem]] = {}
    for row in rows:
        grouped.setdefault(row.item_id, []).append(row)
    entries = (_entry(group[0].item, group) for group in grouped.values())
    return [entry for entry in entries if entry is not None]


def stock_item(warband: Warband, item: Item, quantity: int, cost: int | None) -> StashEntry | None:
    """POST items/: add copies to the stash; without a cost, an item with one availability costs that. Copies
    already held keep their cost (BUG-117)."""
    if cost is None:
        availabilities = list(item.availabilities.all())
        if len(availabilities) == 1:
            cost = availabilities[0].cost
    add_to_stash(warband.id, item.id, quantity, cost)
    return stash_entry(warband.id, item)
