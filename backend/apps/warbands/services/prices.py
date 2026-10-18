"""What an item costs in a campaign now (decisions 3 and 11, ECON-TWEAK-02 and -03).

A campaign's own catalogue entry with a global item's name replaces that item in the campaign (a house rule:
the campaign catalogue lists it instead), so a global item's current price is its replacement's when there is
one. An item's price is the lowest cost among its availabilities (the price the catalogue lists first); an item
without availabilities has no current price. Buying with no price sent pays the current price; the suggested
sale price is half of it, rounded up (decision 3), or half the copy's stored cost when there is no current price.

Rows that reach an item (a unit's copies, stash rows) read the house rule with themselves (`house_rule_prices`),
so payloads show sale prices without another query.
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


def house_rule_prices(campaign_ref: str, name_ref: str) -> dict[str, Any]:
    """Annotations for rows that reach an item: `house_rule`, whether the campaign has its own entry of the item's
    name, and `house_price`, that entry's price (for a campaign's own item, its own entry)."""
    house = Item.objects.filter(campaign_id=OuterRef(campaign_ref), name=OuterRef(name_ref))
    price = house.order_by("id").annotate(price=Min("availabilities__cost")).values("price")[:1]
    return {"house_rule": Exists(house), "house_price": Subquery(price)}


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


def replacements(campaign_id: int, names: Iterable[str]) -> dict[str, int | None]:
    """The campaign's own price for each of `names` it has an entry of (one query)."""
    wanted = set(names)
    if not wanted:
        return {}
    rows = (
        Item.objects.filter(campaign_id=campaign_id, name__in=wanted)
        .annotate(price=Min("availabilities__cost"))
        .order_by("id")
        .values_list("name", "price")
    )
    found: dict[str, int | None] = {}
    for name, price in rows:
        found.setdefault(name, price)
    return found


class CampaignPrices:
    """Current prices in one campaign, the house-rule replacements read once for the items asked about."""

    def __init__(self, campaign_id: int) -> None:
        self.campaign_id = campaign_id
        self._replacements: dict[str, int | None] = {}
        self._asked: set[str] = set()
        self._own: dict[int, int | None] = {}  # item id -> its own price, read once

    def load(self, items: Iterable[Item]) -> "CampaignPrices":
        """Read the replacements for every global item in `items` not asked about yet (at most one query)."""
        names = {item.name for item in items if item.campaign_id is None} - self._asked
        if names:
            self._replacements.update(replacements(self.campaign_id, names))
            self._asked |= names
        return self

    def current(self, item: Item) -> int | None:
        if item.campaign_id is None:
            self.load([item])
            if item.name in self._replacements:
                return self._replacements[item.name]
        if item.id not in self._own:
            self._own[item.id] = own_price(item)
        return self._own[item.id]

    def availability_price(self, item: Item, availability_id: int) -> int | None:
        """The cost of one of the item's availabilities (or its replacement's); None when it isn't one of them."""
        availabilities = ItemAvailability.objects.filter(id=availability_id)
        replacement = Q(item__campaign_id=self.campaign_id, item__name=item.name) if item.campaign_id is None else Q()
        found = availabilities.filter(Q(item=item) | replacement) if replacement else availabilities.filter(item=item)
        cost: int | None = found.values_list("cost", flat=True).first()
        return cost

    def sale_price(self, item: Item, stored_cost: int | None) -> SalePrice:
        return sale_price(self.current(item), stored_cost)
