"""A warband's stash stock: each copy keeps the cost it came with (BUG-117), changed without lost updates (BUG-36).

The stash holds one row per item and cost (`unique_warband_item_cost`, an unknown cost counting as one cost), so
copies that cost 10 and 12 are two rows and nothing is re-priced. Copies are added to their cost's row with one
`F("quantity") + n` UPDATE; a first insert that races another request's falls back to that increment. Copies
are taken from the item's rows locked with `select_for_update`, the most recently started row first (or only
the rows of one cost), by guarded UPDATEs or by deleting a row with its last copy, so two requests can't both
take the last copy. Call `remove_from_stash` inside a transaction: the locks last until it commits.

A copy made of a material (weapon materials: `apps/items/materials.py`) is its own row and its own entry, so a
Gromril Sword never merges with a plain one; `material` names it ("" for plain, `ANY_MATERIAL` to reach every row).

Answers show one entry per item and material (`StashEntry`): the total, the cost of the copies that would leave
first, and each cost's count.
"""

from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass, field

from django.db import IntegrityError, transaction
from django.db.models import F, Q, QuerySet

from apps.items.materials import priced
from apps.items.models import Item
from apps.warbands.models import Warband, WarbandItem
from apps.warbands.services.prices import annotated_current, house_rule_prices, own_price_of

ANY_COST = object()  # remove_from_stash takes copies of every cost unless one is named
ANY_MATERIAL = object()  # ... and of every material unless one is named ("" is plain)


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
    """One item in the stash at one material, as answers show it."""

    item: Item
    quantity: int
    cost: int | None  # the cost of the copies that leave first (the newest row's)
    costs: list[CostCount] = field(default_factory=list)  # newest row first
    current_price: int | None = None  # what a copy like this costs now (its material's price: materials.py)
    material: str = ""  # what these copies are made of ("" plain)


@dataclass(frozen=True)
class StashTake:
    item: Item | None  # None when the stash held no copy
    costs: list[int | None]  # each copy taken, in the order taken
    remaining: StashEntry | None  # what is left of the item at that material, None when the last copy went
    materials: list[str] = field(default_factory=list)  # what each copy taken is made of, beside its cost


def _cost_filter(cost: int | None) -> Q:
    return Q(cost__isnull=True) if cost is None else Q(cost=cost)


def add_to_stash(warband_id: int, item_id: int, quantity: int, cost: int | None, material: str = "") -> None:
    """Add `quantity` copies at `cost` (None: unknown) made of `material` ("" plain) to that row."""
    if quantity <= 0:
        return
    rows = WarbandItem.objects.filter(_cost_filter(cost), warband_id=warband_id, item_id=item_id, material=material)
    if rows.update(quantity=F("quantity") + quantity):
        return
    try:
        with transaction.atomic():  # a savepoint, so a lost race leaves the caller's transaction usable
            WarbandItem.objects.create(
                warband_id=warband_id, item_id=item_id, quantity=quantity, cost=cost, material=material
            )
    except IntegrityError:  # another request inserted the row first: add to it instead
        rows.update(quantity=F("quantity") + quantity)


def add_costs(warband_id: int, item_id: int, costs: Iterable[int | None], materials: Iterable[str] = ()) -> None:
    """Add one copy per cost in `costs` (one statement per distinct cost and material); `materials` is each copy's
    material beside its cost, and an empty one makes every copy plain."""
    named = list(materials)
    pairs = list(zip(costs, named, strict=True)) if named else [(cost, "") for cost in costs]
    for (cost, material), quantity in Counter(pairs).items():
        add_to_stash(warband_id, item_id, quantity, cost, material)


def _priced(rows: QuerySet[WarbandItem]) -> QuerySet[WarbandItem]:
    """Stash rows with their item's current campaign price read in the same query."""
    return rows.annotate(**house_rule_prices("warband__campaign_id", "item_id"), own_price=own_price_of("item_id"))


def _entry(item: Item, rows: list[WarbandItem], material: str = "") -> StashEntry | None:
    """One entry from the rows of one item and material: the copies' current price is that material's."""
    own = annotated_current(rows[0], getattr(rows[0], "own_price", None)) if rows else None
    current = priced(material, own)
    rows = [row for row in rows if row.quantity > 0]
    if not rows:
        return None
    costs = [CostCount(row.cost, row.quantity) for row in rows]
    return StashEntry(item, sum(row.quantity for row in rows), rows[0].cost, costs, current, material)


def remove_from_stash(
    warband_id: int,
    item_id: int,
    quantity: int,
    cost: object = ANY_COST,
    material: object = ANY_MATERIAL,
    *,
    up_to: bool = False,
) -> StashTake:
    """Take `quantity` copies out (of one cost when `cost` is given, of one material when `material` is), newest row
    first. StashShortage when the stash holds fewer, unless `up_to`, which takes what there is."""
    rows = _priced(WarbandItem.objects.select_for_update(of=("self",)).select_related("item__bestiary_entry"))
    held_rows = list(rows.filter(warband_id=warband_id, item_id=item_id).order_by("-id"))
    if material is not ANY_MATERIAL:
        held_rows = [row for row in held_rows if row.material == material]
    takeable = held_rows if cost is ANY_COST else [row for row in held_rows if row.cost == cost]
    held = sum(row.quantity for row in takeable)
    if held < quantity and not up_to:
        raise StashShortage("Item not found in stash.", held=held)
    taken: list[int | None] = []
    made_of: list[str] = []
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
        made_of += [row.material] * take
    item = held_rows[0].item if held_rows else None
    if item is None:
        return StashTake(None, taken, None, made_of)
    # what is left of the item at the material the copies came from (the newest row's when none was named)
    left = made_of[0] if made_of else held_rows[0].material
    return StashTake(item, taken, _entry(item, [row for row in held_rows if row.material == left], left), made_of)


def stash_entry(warband_id: int, item: Item, material: str = "") -> StashEntry | None:
    """The item's stash entry at one material as stored now, for an answer (None without copies)."""
    held = WarbandItem.objects.filter(warband_id=warband_id, item_id=item.id, material=material)
    rows = list(_priced(held).order_by("-id"))
    return _entry(item, rows, material)


def stash_entries(warband: Warband) -> list[StashEntry]:
    """The whole stash, one entry per item and material, by item name (one query)."""
    rows = _priced(WarbandItem.objects.filter(warband=warband).select_related("item__bestiary_entry"))
    rows = rows.order_by("item__name", "item__id", "material", "-id")
    grouped: dict[tuple[int, str], list[WarbandItem]] = {}
    for row in rows:
        grouped.setdefault((row.item_id, row.material), []).append(row)
    entries = (_entry(group[0].item, group, material) for (_item_id, material), group in grouped.items())
    return [entry for entry in entries if entry is not None]


def entries_of(warband_id: int, item_ids: Iterable[int]) -> list[StashEntry]:
    """Every stash entry of these items, of any material, in item and material order (one query): what a loadout
    change answers with, so a Gromril Sword's row is sent beside the plain one."""
    wanted = list(dict.fromkeys(item_ids))
    if not wanted:
        return []
    rows = _priced(WarbandItem.objects.filter(warband_id=warband_id, item_id__in=wanted))
    rows = rows.select_related("item__bestiary_entry").order_by("item__id", "material", "-id")
    grouped: dict[tuple[int, str], list[WarbandItem]] = {}
    for row in rows:
        grouped.setdefault((row.item_id, row.material), []).append(row)
    entries = (_entry(group[0].item, group, material) for (_item_id, material), group in grouped.items())
    return [entry for entry in entries if entry is not None]
