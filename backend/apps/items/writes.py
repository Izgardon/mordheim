"""Custom items written whole or not at all (BUG-53), their links in bulk (PERF-44).

The input is already validated (`ItemWriteSerializer`): costs, rarities and every linked id. Each write runs in the
catalogue write's transaction (`apps/core/catalogue/writes.py`), so a failure keeps nothing, and the availabilities,
their restrictions and the properties go in one INSERT each.
"""

from collections.abc import Mapping
from typing import Any

from apps.restrictions.serializers import unique_restriction_notes

from .models import Item, ItemAvailability, ItemAvailabilityRestriction, ItemPropertyLink

LINKS = ("availabilities", "property_ids")


def write_availabilities(item: Item, rows: list[Mapping[str, Any]]) -> None:
    """The item's new prices with their restrictions (also a beast's Animal item, from the bestiary's writes)."""
    created = ItemAvailability.objects.bulk_create(
        [
            ItemAvailability(
                item=item, cost=row["cost"], rarity=row["rarity"], variable_cost=row.get("variable_cost") or None
            )
            for row in rows
        ]
    )
    ItemAvailabilityRestriction.objects.bulk_create(
        [
            ItemAvailabilityRestriction(
                item_availability=availability,
                restriction_id=note["restriction_id"],
                additional_note=note["additional_note"],
            )
            for availability, row in zip(created, rows, strict=True)
            for note in unique_restriction_notes(row.get("restrictions", []))
        ]
    )


def _write_properties(item: Item, property_ids: list[int]) -> None:
    ItemPropertyLink.objects.bulk_create([ItemPropertyLink(item=item, property_id=pk) for pk in property_ids])


def replace_availabilities(item: Item, rows: list[Mapping[str, Any]]) -> None:
    ItemAvailability.objects.filter(item=item).delete()
    write_availabilities(item, rows)


def create_item(campaign_id: int, data: Mapping[str, Any]) -> Item:
    """The campaign's new item with its prices and properties."""
    fields = {key: value for key, value in data.items() if key not in LINKS}
    item = Item.objects.create(campaign_id=campaign_id, **fields)
    write_availabilities(item, data.get("availabilities", []))
    _write_properties(item, data.get("property_ids", []))
    return item


def update_item(item: Item, data: Mapping[str, Any]) -> Item:
    """An edit: the fields it sends change; availabilities or properties it sends replace the old ones."""
    fields = {key: value for key, value in data.items() if key not in LINKS}
    for field, value in fields.items():
        setattr(item, field, value)
    if fields:
        item.save(update_fields=list(fields))
    if "availabilities" in data:
        replace_availabilities(item, data["availabilities"])
    if "property_ids" in data:
        ItemPropertyLink.objects.filter(item=item).delete()
        _write_properties(item, data["property_ids"])
    return item
