"""Beasts for the warband tests (the bestiary rewrite step 4): a bestiary entry with its Animal item, as the seeder and
the bestiary's writes leave them."""

from typing import Any

from apps.bestiary.models import BestiaryEntry
from apps.campaigns.models import Campaign
from apps.items.models import Item, ItemAvailability

HORSE_PROFILE: dict[str, Any] = {
    "movement": 8,
    "weapon_skill": 3,
    "strength": 3,
    "toughness": 3,
    "wounds": 1,
    "initiative": 3,
}
HORSE_PROFILE |= {"attacks": 1, "leadership": 5}
DOG_PROFILE: dict[str, Any] = {
    "movement": 6,
    "weapon_skill": 4,
    "strength": 4,
    "toughness": 3,
    "wounds": 1,
    "initiative": 4,
}
DOG_PROFILE |= {"attacks": 1, "leadership": 5}


def make_animal(
    name: str, kind: str, *, cost: int | None = None, campaign: Campaign | None = None, **fields: Any
) -> Item:
    """The Animal item of a new beast called `name` (its beast is `item.bestiary_entry`), priced at `cost`."""
    beast = BestiaryEntry.objects.create(name=name, kind=kind, campaign=campaign, **fields)
    item = Item.objects.create(
        name=name,
        campaign=campaign,
        type="Animal",
        subtype=beast.get_kind_display(),
        listed=beast.available_in_shop,
        bestiary_entry=beast,
    )
    if cost is not None:
        ItemAvailability.objects.create(item=item, cost=cost, rarity=2)
    return item


def warhorse(**fields: Any) -> Item:
    return make_animal("Warhorse", "mount", cost=80, rating_bonus=5, available_in_shop=True, **HORSE_PROFILE, **fields)


def raven(**fields: Any) -> Item:
    return make_animal("Raven", "pet", cost=60, has_profile=False, available_in_shop=True, **fields)


def wardogs(**fields: Any) -> Item:
    return make_animal("Wardogs", "creature", cost=25, available_in_shop=True, **DOG_PROFILE, **fields)
