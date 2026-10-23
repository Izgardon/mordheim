"""A beast's Animal item, kept in step with it (the bestiary rewrite step 3): one item per beast, always.

The item lives in the beast's campaign (the book's beast has the book's item), carries the beast's name, kind (as its
subtype: Mount, Pet or Creature) and description, and is listed in the shop exactly when the beast is sold. Its grade
and prices are the item's own: a bestiary write sends them under `item`, and a beast that isn't sold keeps them. The
bestiary's creates and edits, and seed_bestiary, write it through here; the catalogue framework versions, reverts,
archives, removes and restores it with the beast (the bestiary's twin, `core/catalogue/kinds.py`).
"""

from collections.abc import Mapping
from typing import Any

from apps.items.models import ANIMAL, Item
from apps.items.writes import replace_availabilities, write_availabilities

from .models import BEAST_KINDS, BestiaryEntry

SUBTYPES = dict(BEAST_KINDS)  # "mount" -> "Mount": the Animal item's subtype


def item_fields(entry: BestiaryEntry) -> dict[str, Any]:
    """What the item takes from its beast on every write."""
    return {
        "name": entry.name,
        "subtype": SUBTYPES[entry.kind],
        "description": entry.description,
        "listed": entry.available_in_shop,
        "updated_at": entry.updated_at,
        "updated_by_id": entry.updated_by_id,
    }


def create_item(entry: BestiaryEntry, data: Mapping[str, Any]) -> Item:
    """The beast's new item, with the grade and prices `data` (a write's `item`) gives."""
    item = Item.objects.create(
        campaign_id=entry.campaign_id,
        type=ANIMAL,
        bestiary_entry=entry,
        grade=data.get("grade", ""),
        **item_fields(entry),
    )
    write_availabilities(item, data.get("availabilities", []))
    return item


def sync_item(entry: BestiaryEntry, data: Mapping[str, Any]) -> Item:
    """The beast's item after an edit: in step with the beast, its grade and prices replaced when `data` sends them
    (kept otherwise, whether or not the beast is sold); made when the beast has none yet."""
    item = Item.objects.filter(bestiary_entry=entry).first()
    if item is None and entry.replaces_id is None:
        return create_item(entry, data)
    if item is None:
        item = _version_of_book_item(entry)
    fields = item_fields(entry) | ({"grade": data["grade"]} if "grade" in data else {})
    Item.objects.filter(pk=item.pk).update(**fields)
    if "availabilities" in data:
        replace_availabilities(item, data["availabilities"])
    return item


def _version_of_book_item(version: BestiaryEntry) -> Item:
    """A version written without its item (a book beast that had none at its first edit): the campaign's version of
    the book beast's item, made first when the book beast has none, so Revert can take the item back with the beast."""
    from apps.core.catalogue.kinds import ITEMS  # catalogue -> hooks -> bestiary writes -> here
    from apps.core.catalogue.versions import editable

    assert version.replaces_id is not None and version.campaign_id is not None  # sync_item's caller: a version
    book = BestiaryEntry.objects.get(pk=version.replaces_id)
    book_item = Item.objects.filter(bestiary_entry=book).first() or create_item(book, {})
    item: Item = editable(ITEMS, book_item, version.campaign_id)  # its copy points at `version` (copy_entry)
    return item
