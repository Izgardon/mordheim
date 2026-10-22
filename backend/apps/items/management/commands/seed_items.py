"""Seed the book's items and item properties from JSON (`apps/items/data/`).

Campaign rows are never read or written (BUG-17); the run is all or nothing; there is no --truncate (BUG-16: it
deleted campaign rows and every copy of them), a wipe replaces it. It ends by syncing every campaign's house rules
again, so their clones take the reseeded book prices (BUG-51).
"""

from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.campaigns.services.house_rules import resync_every_campaign
from apps.core.catalogue.cache import bump
from apps.core.seeding import clean, entry_value, read_json_list, reset_sequence, sync_availabilities, upsert_global
from apps.items.models import Item, ItemProperty, ItemPropertyLink
from apps.restrictions.book import BookRestrictions

DEFAULT_JSON_PATHS = [Path("apps/items/data/standard-items.json")]
DEFAULT_PROPERTY_PATHS = [Path("apps/items/data/item-properties.json")]

HEADER_ALIASES = {
    "name": ["name", "item"],
    "type": ["type", "category"],
    "subtype": ["subtype", "sub_type"],
    "grade": ["grade", "tier"],
    "cost": ["cost", "price"],
    "rarity": ["rarity", "availability", "avail"],
    "unique_to": ["unique_to", "unique"],
    "variable_cost": ["variable_cost", "variable", "cost_variable"],
    "single_use": ["single_use", "single_use_flag", "single-use"],
    "description": ["description", "desc", "details"],
    "strength": ["strength", "str"],
    "range": ["range"],
    "save": ["save", "armour_save"],
    "statblock": ["statblock", "stats", "stat_block"],
    "properties": ["properties", "item_properties", "special_rules"],
    "availabilities": ["availabilities"],
}


def _value(entry: Any, field: str) -> Any:
    return entry_value(entry, HEADER_ALIASES[field])


def _key(name: Any, property_type: Any = "") -> tuple[str, str]:
    return clean(name).lower(), clean(property_type).lower()


def _property_id(value: Any) -> int | None:
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    return None


class BookProperties:
    """The book's item properties by id and by name and type, kept current as the run writes them."""

    def __init__(self) -> None:
        self.by_id: dict[int, ItemProperty] = {}
        self.by_key: dict[tuple[str, str], ItemProperty] = {}
        for prop in ItemProperty.objects.filter(campaign__isnull=True):
            self.remember(prop)
        self.campaign_ids = set(ItemProperty.objects.filter(campaign__isnull=False).values_list("id", flat=True))

    def remember(self, prop: ItemProperty) -> None:
        self.by_id[prop.id] = prop
        self.by_key[_key(prop.name, prop.type)] = prop

    def seed(self, entry: dict[str, Any], path: Path) -> None:
        """One row of the properties file, upserted by its id, or by its name and type when it has none."""
        prop_id, name, prop_type = _property_id(entry.get("id")), clean(entry.get("name")), clean(entry.get("type"))
        if not name:
            return
        existing = self.by_key.get(_key(name, prop_type))
        if existing and prop_id and existing.id != prop_id:
            raise CommandError(
                f"Duplicate property name/type with different ids: {name} [{prop_type or 'Any'}] ({prop_id} vs {existing.id})"
            )
        if prop_id in self.campaign_ids:  # the id was given to a campaign's property since the last seed
            raise CommandError(f"Property id {prop_id} ({name}) belongs to a campaign's property: {path}")
        fields = {"name": name, "description": clean(entry.get("description")), "type": prop_type}
        if prop_id is not None:
            prop, _ = ItemProperty.objects.update_or_create(id=prop_id, defaults=fields)
        else:
            prop, _ = ItemProperty.objects.update_or_create(
                name=name, type=prop_type, campaign=None, defaults={"description": fields["description"]}
            )
        for key in [key for key, row in self.by_key.items() if row.id == prop.id]:  # its old name and type
            del self.by_key[key]
        self.remember(prop)

    def linked(self, link: Any, item: dict[str, str], path: Path) -> ItemProperty | None:
        """The property an item's entry names: an id (which must exist), or a name (created in the book, of the item's
        type, when the book has none of that name)."""
        prop_id, name, description, prop_type = None, "", "", ""
        if isinstance(link, dict):
            prop_id, name = _property_id(link.get("id")), clean(link.get("name"))
            description, prop_type = clean(link.get("description")), clean(link.get("type")) or item["type"]
        elif isinstance(link, int):
            prop_id = link
        elif isinstance(link, str):
            prop_id = _property_id(link)
            if prop_id is None:
                name, prop_type = clean(link), item["type"]
        if prop_id is not None:
            if prop_id not in self.by_id:
                raise CommandError(f"Unknown property id {prop_id} for item '{item['name']}' in {path}")
            return self.by_id[prop_id]
        if not name:
            return None
        found = self.by_key.get(_key(name, prop_type or item["type"]))
        if found is None and (prop_type or item["type"]):
            found = self.by_key.get(_key(name, ""))
        if found is None:
            found = ItemProperty.objects.create(name=name, description=description, type=prop_type or item["type"])
            self.remember(found)
        return found


def _item_defaults(entry: Any) -> dict[str, Any]:
    single_use = _value(entry, "single_use")
    return {
        "subtype": clean(_value(entry, "subtype")),
        "grade": clean(_value(entry, "grade")) or "1a",
        "single_use": clean(single_use).lower() in {"1", "true", "yes", "y", "t"} if single_use is not None else False,
        "description": clean(_value(entry, "description")),
        "strength": clean(_value(entry, "strength")).replace(";", "").strip() or None,
        "range": clean(_value(entry, "range")) or None,
        "save_value": clean(_value(entry, "save")) or None,
        "statblock": clean(_value(entry, "statblock")) or None,
    }


def _availability_rows(entry: Any) -> list[Any]:
    """The entry's prices: its availabilities, or (an older shape) one flat cost, rarity, unique-to and variable cost."""
    rows: Any = _value(entry, "availabilities")
    if rows and isinstance(rows, list):
        return list(rows)
    return [
        {
            "cost": _value(entry, "cost"),
            "rarity": _value(entry, "rarity"),
            "unique_to": clean(_value(entry, "unique_to")),
            "variable_cost": clean(_value(entry, "variable_cost")),
        }
    ]


def _property_links(entry: Any) -> list[Any]:
    links = _value(entry, "properties")
    if links and isinstance(links, (str, int)):
        return [links]
    return links if links and isinstance(links, list) else []


class Command(BaseCommand):
    help = "Seed items from JSON data."

    def add_arguments(self, parser):
        parser.add_argument("--json", dest="json_path", help="Path to a JSON file.")
        parser.add_argument(
            "--properties",
            dest="properties_path",
            help="Path to a JSON file containing item properties.",
        )

    def handle(self, *args, **options):
        """Upsert the book's items and properties, all or nothing (BUG-17); campaign rows are never read or written."""
        with transaction.atomic():
            self._import(options)
            bump(None)  # every cached catalogue list shows the book (PERF-13)

    def _import(self, options: dict[str, Any]) -> None:
        json_path, properties_path = options.get("json_path"), options.get("properties_path")
        paths = [Path(json_path)] if json_path else [path for path in DEFAULT_JSON_PATHS if path.exists()]
        if not paths:
            raise CommandError(
                "JSON file(s) not found. Provide --json or place data at apps/items/data/standard-*.json."
            )
        property_paths = (
            [Path(properties_path)] if properties_path else [path for path in DEFAULT_PROPERTY_PATHS if path.exists()]
        )
        properties = BookProperties()
        for path in property_paths:
            for entry in read_json_list(path):
                if isinstance(entry, dict):
                    properties.seed(entry, path)
        if property_paths:
            reset_sequence(ItemProperty)
        created, updated, skipped = self._seed_items(paths, properties, BookRestrictions())
        synced = resync_every_campaign()  # house-rule clones take the reseeded book prices (BUG-51)
        self.stdout.write(
            self.style.SUCCESS(
                f"Items import complete. Created: {created}, Updated: {updated}, Skipped: {skipped}, "
                f"house rules synced: {synced}"
            )
        )

    def _seed_items(self, paths: list[Path], properties: BookProperties, restrictions: BookRestrictions) -> list[int]:
        """Upsert every item of the files with its prices and properties; [created, updated, skipped]."""
        counts = [0, 0, 0]
        for path in paths:
            for entry in read_json_list(path, "item objects"):
                name, item_type = clean(_value(entry, "name")), clean(_value(entry, "type"))
                if not name or not item_type:
                    counts[2] += 1
                    continue
                item, was_created = upsert_global(Item, {"name": name, "type": item_type}, _item_defaults(entry))
                counts[0 if was_created else 1] += 1
                sync_availabilities(item, _availability_rows(entry), restrictions)
                for link in _property_links(entry):
                    prop = properties.linked(link, {"name": name, "type": item_type}, path)
                    if prop is not None:
                        ItemPropertyLink.objects.get_or_create(item=item, property=prop)
        return counts
