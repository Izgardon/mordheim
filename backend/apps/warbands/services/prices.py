"""What an item costs in a campaign now (decisions 3 and 11, ECON-TWEAK-02 and -03; CAT-TWEAK-03).

A campaign's version of a book item (its `replaces` is the book item: an edit, or a house rule's clone) stands in for
it in the campaign, so a book item's current price is its version's when the campaign has one. Only a version
counts: a campaign entry that merely shares the name, of any type, changes nothing (BUG-18). An item's price is the
lowest cost among its availabilities (the price the catalogue lists first); an item without availabilities has no
current price. Buying with no price sent pays the current price; the suggested sale price is half of it, rounded up
(decision 3), or half the copy's stored cost when there is no current price.

Rows that reach an item (a unit's copies, stash rows) read the campaign's version with themselves
(`house_rule_prices`), so payloads show sale prices without another query.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from django.db.models import Exists, Min, OuterRef, Q, Subquery

from apps.items.models import Item, ItemAvailability

# How a suggested sale price was found.
FROM_CAMPAIGN_PRICE = "campaign_price"
FROM_STORED_COST = "stored_cost"


@dataclass(frozen=True)
class SalePrice:
    price: int | None  # None when neither a current price nor a stored cost is known
    basis: str | None  # FROM_CAMPAIGN_PRICE, FROM_STORED_COST, or None


def half_up(value: int) -> int:
    return (value + 1) // 2


def sale_price(current: int | None, stored_cost: int | None) -> SalePrice:
    """Half the current campaign price, rounded up (ECON-TWEAK-02); half the stored cost when there is none."""
    if current is not None:
        return SalePrice(half_up(current), FROM_CAMPAIGN_PRICE)
    if stored_cost is not None:
        return SalePrice(half_up(stored_cost), FROM_STORED_COST)
    return SalePrice(None, None)


def house_rule_prices(campaign_ref: str, item_ref: str) -> dict[str, Any]:
    """Annotations for rows that reach an item: `house_rule`, whether the campaign has a version of the item, and
    `house_price`, the version's price (a campaign's own item has none: its own price stands)."""
    version = Item.objects.filter(campaign_id=OuterRef(campaign_ref), replaces_id=OuterRef(item_ref))
    price = version.annotate(price=Min("availabilities__cost")).values("price")[:1]
    return {"house_rule": Exists(version), "house_price": Subquery(price)}


def own_price_of(item_ref: str) -> Subquery:
    """An annotation: the lowest cost among the referenced item's availabilities."""
    costs = ItemAvailability.objects.filter(item=OuterRef(item_ref)).order_by().values("item")
    return Subquery(costs.annotate(price=Min("cost")).values("price"))


def annotated_current(row: Any, own: int | None) -> int | None:
    """The current price of the item a row annotated by `house_rule_prices` reaches (`own`: the item's own price;
    a row read without the annotations knows only that)."""
    house_price: int | None = getattr(row, "house_price", None)
    return house_price if getattr(row, "house_rule", False) else own


def own_price(item: Item) -> int | None:
    """The lowest cost among the item's availabilities (prefetched or read), None without any."""
    costs = [availability.cost for availability in item.availabilities.all()]
    return min(costs) if costs else None


def replacements(campaign_id: int, book_ids: Iterable[int]) -> dict[int, int | None]:
    """The price of the campaign's version of each of `book_ids` it has one of (one query)."""
    wanted = set(book_ids)
    if not wanted:
        return {}
    rows = (
        Item.objects.filter(campaign_id=campaign_id, replaces_id__in=wanted)
        .annotate(price=Min("availabilities__cost"))
        .values_list("replaces_id", "price")
    )
    return dict(rows)


class CampaignPrices:
    """Current prices in one campaign, the versions read once for the book items asked about."""

    def __init__(self, campaign_id: int) -> None:
        self.campaign_id = campaign_id
        self._replacements: dict[int, int | None] = {}
        self._asked: set[int] = set()
        self._own: dict[int, int | None] = {}  # item id -> its own price, read once

    def load(self, items: Iterable[Item]) -> "CampaignPrices":
        """Read the versions of every book item in `items` not asked about yet (at most one query)."""
        ids = {item.id for item in items if item.campaign_id is None} - self._asked
        if ids:
            self._replacements.update(replacements(self.campaign_id, ids))
            self._asked |= ids
        return self

    def current(self, item: Item) -> int | None:
        if item.campaign_id is None:
            self.load([item])
            if item.id in self._replacements:
                return self._replacements[item.id]
        if item.id not in self._own:
            self._own[item.id] = own_price(item)
        return self._own[item.id]

    def availability_price(self, item: Item, availability_id: int) -> int | None:
        """The cost of one of the item's availabilities (or its campaign version's); None when it isn't one of them."""
        scope = Q(item=item)
        if item.campaign_id is None:
            scope |= Q(item__campaign_id=self.campaign_id, item__replaces_id=item.id)
        cost: int | None = (
            ItemAvailability.objects.filter(scope, id=availability_id).values_list("cost", flat=True).first()
        )
        return cost

    def sale_price(self, item: Item, stored_cost: int | None) -> SalePrice:
        return sale_price(self.current(item), stored_cost)
