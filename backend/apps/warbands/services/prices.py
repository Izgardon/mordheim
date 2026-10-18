"""What an item costs in a campaign now (decisions 3 and 11, ECON-TWEAK-02 and -03).

A campaign's own catalogue entry with a global item's name replaces that item in the campaign (a house rule:
the campaign catalogue lists it instead), so a global item's current price is its replacement's when there is
one. An item's price is the lowest cost among its availabilities (the price the catalogue lists first); an item
without availabilities has no current price. Buying with no price sent pays the current price.
"""

from collections.abc import Iterable

from django.db.models import Min, Q

from apps.items.models import Item, ItemAvailability


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
        return own_price(item)

    def availability_price(self, item: Item, availability_id: int) -> int | None:
        """The cost of one of the item's availabilities (or its replacement's); None when it isn't one of them."""
        availabilities = ItemAvailability.objects.filter(id=availability_id)
        replacement = Q(item__campaign_id=self.campaign_id, item__name=item.name) if item.campaign_id is None else Q()
        found = availabilities.filter(Q(item=item) | replacement) if replacement else availabilities.filter(item=item)
        cost: int | None = found.values_list("cost", flat=True).first()
        return cost
