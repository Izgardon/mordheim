import json
import re
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.campaigns.models import CampaignType
from apps.items.models import Item, ItemCampaignType, ItemProperty, ItemPropertyLink

DEFAULT_JSON_PATHS = [
    Path("apps/items/data/standard-items.json"),
    Path("apps/items/data/standard-weapons.json"),
    Path("apps/items/data/standard-armour.json"),
    Path("apps/items/data/standard-misc.json"),
    Path("apps/items/data/standard-animals.json"),
]

HEADER_ALIASES = {
    "name": ["name", "item"],
    "type": ["type", "category"],
    "subtype": ["subtype", "sub_type"],
    "grade": ["grade", "tier"],
    "cost": ["cost", "price"],
    "rarity": ["rarity", "availability", "avail"],
    "unique_to": ["unique_to", "unique"],
    "variable": ["variable", "cost_variable", "variable_cost"],
    "single_use": ["single_use", "single_use_flag", "single-use"],
    "description": ["description", "desc", "details"],
    "strength": ["strength", "str"],
    "range": ["range"],
    "save": ["save", "armour_save"],
    "statblock": ["statblock", "stats", "stat_block"],
    "properties": ["properties", "item_properties", "special_rules"],
}


def _normalize(value):
    return str(value or "").strip()


def _normalize_bool(value):
    cleaned = _normalize(value).lower()
    return cleaned in {"1", "true", "yes", "y", "t"}


def _parse_int(value, default=0):
    cleaned = _normalize(value)
    if not cleaned:
        return default
    match = re.search(r"-?\d+", cleaned)
    if not match:
        return default
    try:
        return int(match.group(0))
    except ValueError:
        return default


def _normalize_rarity(value, default=2):
    parsed = _parse_int(value, default=default)
    if parsed < 2:
        return 2
    if parsed > 20:
        return 20
    return parsed


def _get_entry_value(entry, aliases):
    if not isinstance(entry, dict):
        return None
    key_map = {str(key).strip().lower(): key for key in entry.keys()}
    for alias in aliases:
        key = key_map.get(alias)
        if key is not None:
            return entry.get(key)
    return None


def _resolve_default_json_paths():
    return [path for path in DEFAULT_JSON_PATHS if path.exists()]


class Command(BaseCommand):
    help = "Seed items from JSON data."

    def add_arguments(self, parser):
        parser.add_argument("--json", dest="json_path", help="Path to a JSON file.")
        parser.add_argument(
            "--truncate",
            action="store_true",
            help="Delete existing items before importing.",
        )

    def handle(self, *args, **options):
        json_path = options.get("json_path")
        truncate = options.get("truncate")

        if truncate:
            ItemPropertyLink.objects.all().delete()
            ItemCampaignType.objects.all().delete()
            Item.objects.all().delete()
            ItemProperty.objects.all().delete()

        paths = (
            [Path(json_path)]
            if json_path
            else _resolve_default_json_paths()
        )
        if not paths:
            raise CommandError(
                "JSON file(s) not found. Provide --json or place data at apps/items/data/standard-*.json."
            )

        created = 0
        updated = 0
        skipped = 0
        property_cache = {
            f"{prop.name.strip().lower()}:{prop.type.strip().lower()}": prop
            for prop in ItemProperty.objects.all()
        }
        campaign_types = list(CampaignType.objects.all())

        for path in paths:
            try:
                data = json.loads(path.read_text(encoding="utf-8-sig"))
            except json.JSONDecodeError as exc:
                raise CommandError(f"Unable to parse JSON ({path}): {exc}") from exc

            if not isinstance(data, list):
                raise CommandError(f"JSON data should be a list of item objects: {path}")

            for entry in data:
                raw_name = _normalize(_get_entry_value(entry, HEADER_ALIASES["name"]))
                raw_type = _normalize(_get_entry_value(entry, HEADER_ALIASES["type"]))
                raw_subtype = _normalize(
                    _get_entry_value(entry, HEADER_ALIASES["subtype"])
                )
                raw_grade = _normalize(
                    _get_entry_value(entry, HEADER_ALIASES["grade"])
                )
                raw_cost = _get_entry_value(entry, HEADER_ALIASES["cost"])
                raw_rarity = _get_entry_value(entry, HEADER_ALIASES["rarity"])
                raw_unique = _normalize(
                    _get_entry_value(entry, HEADER_ALIASES["unique_to"])
                )
                raw_variable = _normalize(
                    _get_entry_value(entry, HEADER_ALIASES["variable"])
                )
                raw_description = _normalize(
                    _get_entry_value(entry, HEADER_ALIASES["description"])
                )
                raw_strength = _normalize(
                    _get_entry_value(entry, HEADER_ALIASES["strength"])
                )
                raw_range = _normalize(
                    _get_entry_value(entry, HEADER_ALIASES["range"])
                )
                raw_save = _normalize(_get_entry_value(entry, HEADER_ALIASES["save"]))
                raw_statblock = _normalize(
                    _get_entry_value(entry, HEADER_ALIASES["statblock"])
                )
                raw_single_use = _get_entry_value(
                    entry, HEADER_ALIASES["single_use"]
                )
                raw_properties = _get_entry_value(
                    entry, HEADER_ALIASES["properties"]
                )

                if not raw_name or not raw_type:
                    skipped += 1
                    continue

                cost_value = _parse_int(raw_cost)
                rarity_value = _normalize_rarity(raw_rarity)
                variable_value = raw_variable or None
                single_use_value = (
                    _normalize_bool(raw_single_use)
                    if raw_single_use is not None
                    else False
                )

                item, was_created = Item.objects.update_or_create(
                    name=raw_name,
                    type=raw_type,
                    defaults={
                        "subtype": raw_subtype or "",
                        "grade": raw_grade or "1a",
                        "cost": cost_value,
                        "rarity": rarity_value,
                        "unique_to": raw_unique,
                        "variable": variable_value,
                        "single_use": single_use_value,
                        "description": raw_description,
                        "strength": raw_strength or None,
                        "range": raw_range or None,
                        "save_value": raw_save or None,
                        "statblock": raw_statblock or None,
                    },
                )

                if was_created:
                    created += 1
                else:
                    updated += 1

                if campaign_types:
                    ItemCampaignType.objects.bulk_create(
                        [
                            ItemCampaignType(campaign_type=ct, item=item)
                            for ct in campaign_types
                        ],
                        ignore_conflicts=True,
                    )

                if raw_properties:
                    property_entries = raw_properties
                    if isinstance(raw_properties, str):
                        property_entries = [
                            {"name": raw_properties, "description": ""}
                        ]

                    if isinstance(property_entries, list):
                        for prop_entry in property_entries:
                            if isinstance(prop_entry, str):
                                prop_name = _normalize(prop_entry)
                                prop_description = ""
                            else:
                                prop_name = _normalize(prop_entry.get("name"))
                                prop_description = _normalize(
                                    prop_entry.get("description")
                                )

                            if not prop_name:
                                continue

                            cache_key = f"{prop_name.lower()}:{raw_type.lower()}"
                            item_property = property_cache.get(cache_key)
                            if not item_property:
                                item_property = ItemProperty.objects.create(
                                    name=prop_name,
                                    description=prop_description,
                                    type=raw_type,
                                )
                                property_cache[cache_key] = item_property

                            ItemPropertyLink.objects.get_or_create(
                                item=item,
                                property=item_property,
                            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Items import complete. Created: {created}, Updated: {updated}, Skipped: {skipped}"
            )
        )
