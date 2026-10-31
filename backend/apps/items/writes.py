"""Items written whole or not at all (BUG-53), their rules and prices in bulk (PERF-44): custom items, a beast's
Animal item (the bestiary) and the seeders all write through here.

The input is already validated (`ItemWriteSerializer`, or the seeder's resolved data): costs, rarities and every
linked id. Each write runs in its caller's transaction, so a failure keeps nothing; the rule links, the price rows
and their who-can lines go in one INSERT each.
"""

from collections.abc import Mapping, Sequence
from typing import Any

from .models import Item, ItemAvailability, ItemAvailabilityWarband, ItemRuleLink

LINKS = ("availabilities", "rules")
ROW_FIELDS = ("label", "cost", "dice", "dice_multiplier", "cost_note", "rarity", "for_everyone", "note")
RULE_FIELDS = ("name", "summary", "text", "table")


def write_availabilities(item: Item, rows: Sequence[Mapping[str, Any]]) -> None:
    """The item's new price rows, each with its who-can lines (`warbands`: `warband_type_id` or `warband_group_id`,
    and `excluded`)."""
    created = ItemAvailability.objects.bulk_create(
        [ItemAvailability(item=item, **{field: row[field] for field in ROW_FIELDS if field in row}) for row in rows]
    )
    ItemAvailabilityWarband.objects.bulk_create(
        [
            ItemAvailabilityWarband(
                availability=availability,
                warband_type_id=line.get("warband_type_id"),
                warband_group_id=line.get("warband_group_id"),
                excluded=bool(line.get("excluded")),
            )
            for availability, row in zip(created, rows, strict=True)
            for line in row.get("warbands", [])
        ]
    )


def replace_availabilities(item: Item, rows: Sequence[Mapping[str, Any]]) -> None:
    ItemAvailability.objects.filter(item=item).delete()
    write_availabilities(item, rows)


def write_rules(item: Item, rows: Sequence[Mapping[str, Any]]) -> None:
    """The item's rules in the order sent: each a shared rule (`rule_id`) or one of its own."""
    ItemRuleLink.objects.bulk_create(
        [
            ItemRuleLink(
                item=item,
                position=position,
                rule_id=row.get("rule_id"),
                **{field: row[field] for field in RULE_FIELDS if field in row},
            )
            for position, row in enumerate(rows)
        ]
    )


def replace_rules(item: Item, rows: Sequence[Mapping[str, Any]]) -> None:
    ItemRuleLink.objects.filter(item=item).delete()
    write_rules(item, rows)


def create_item(campaign_id: int, data: Mapping[str, Any]) -> Item:
    """The campaign's new item with its rules and prices."""
    fields = {key: value for key, value in data.items() if key not in LINKS}
    item = Item.objects.create(campaign_id=campaign_id, **fields)
    write_rules(item, data.get("rules", []))
    write_availabilities(item, data.get("availabilities", []))
    return item


def update_item(item: Item, data: Mapping[str, Any]) -> Item:
    """An edit: the fields it sends change; rules or prices it sends replace the old ones."""
    fields = {key: value for key, value in data.items() if key not in LINKS}
    for field, value in fields.items():
        setattr(item, field, value)
    if fields:
        item.save(update_fields=list(fields))
    if "rules" in data:
        replace_rules(item, data["rules"])
    if "availabilities" in data:
        replace_availabilities(item, data["availabilities"])
    return item
