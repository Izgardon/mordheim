import json
import re
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection

from apps.campaigns.models import CampaignType
from apps.items.models import (
    Item,
    ItemAvailability,
    ItemCampaignType,
    ItemProperty,
    ItemPropertyLink,
)

DEFAULT_JSON_PATHS = [
    Path("apps/items/data/standard-items.json"),
]
DEFAULT_PROPERTY_PATHS = [
    Path("apps/items/data/item-properties.json"),
]

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


def _parse_property_id(value):
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned.isdigit():
            return int(cleaned)
    return None


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


def _resolve_default_property_paths():
    return [path for path in DEFAULT_PROPERTY_PATHS if path.exists()]


def _reset_sequence(model):
    sequence_sql = connection.ops.sequence_reset_sql(no_style(), [model])
    if not sequence_sql:
        return
    with connection.cursor() as cursor:
        for sql in sequence_sql:
            cursor.execute(sql)


def _sync_availabilities(item, availabilities_data):
    """Replace all availability rows for an item."""
    item.availabilities.all().delete()
    if not availabilities_data:
        return
    ItemAvailability.objects.bulk_create(
        [
            ItemAvailability(
                item=item,
                cost=_parse_int(entry.get("cost"), 0),
                rarity=_normalize_rarity(entry.get("rarity")),
                unique_to=_normalize(entry.get("unique_to")),
                variable_cost=_normalize(entry.get("variable_cost")) or None,
            )
            for entry in availabilities_data
        ]
    )


class Command(BaseCommand):
    help = "Seed items from JSON data."

    def add_arguments(self, parser):
        parser.add_argument("--json", dest="json_path", help="Path to a JSON file.")
        parser.add_argument(
            "--properties",
            dest="properties_path",
            help="Path to a JSON file containing item properties.",
        )
        parser.add_argument(
            "--truncate",
            action="store_true",
            help="Delete existing items before importing.",
        )

    def handle(self, *args, **options):
        json_path = options.get("json_path")
        properties_path = options.get("properties_path")
        truncate = options.get("truncate")

        if truncate:
            ItemPropertyLink.objects.all().delete()
            ItemCampaignType.objects.all().delete()
            Item.objects.all().delete()
            ItemProperty.objects.all().delete()

        paths = [Path(json_path)] if json_path else _resolve_default_json_paths()
        if not paths:
            raise CommandError(
                "JSON file(s) not found. Provide --json or place data at apps/items/data/standard-*.json."
            )

        property_paths = (
            [Path(properties_path)]
            if properties_path
            else _resolve_default_property_paths()
        )

        created = 0
        updated = 0
        skipped = 0
        property_cache_by_id = {}
        property_cache_by_name = {}
        for prop in ItemProperty.objects.all():
            name_key = prop.name.strip().lower()
            if name_key and name_key not in property_cache_by_name:
                property_cache_by_name[name_key] = prop
            property_cache_by_id[prop.id] = prop

        if property_paths:
            property_entries = []
            for path in property_paths:
                try:
                    data = json.loads(path.read_text(encoding="utf-8-sig"))
                except json.JSONDecodeError as exc:
                    raise CommandError(
                        f"Unable to parse JSON ({path}): {exc}"
                    ) from exc
                except FileNotFoundError as exc:
                    raise CommandError(
                        f"Property JSON file not found: {path}"
                    ) from exc

                if not isinstance(data, list):
                    raise CommandError(
                        f"Property JSON data should be a list of objects: {path}"
                    )
                property_entries.extend(data)

            for entry in property_entries:
                if not isinstance(entry, dict):
                    continue

                prop_id = _parse_property_id(entry.get("id"))
                prop_name = _normalize(entry.get("name"))
                prop_description = _normalize(entry.get("description"))
                prop_type = _normalize(entry.get("type"))

                if not prop_name:
                    continue

                name_key = prop_name.lower()
                existing = property_cache_by_name.get(name_key)
                if existing and prop_id and existing.id != prop_id:
                    raise CommandError(
                        f"Duplicate property name with different ids: {prop_name} ({prop_id} vs {existing.id})"
                    )

                if prop_id is not None:
                    item_property, _ = ItemProperty.objects.update_or_create(
                        id=prop_id,
                        defaults={
                            "name": prop_name,
                            "description": prop_description,
                            "type": prop_type,
                        },
                    )
                else:
                    item_property, _ = ItemProperty.objects.update_or_create(
                        name=prop_name,
                        defaults={
                            "description": prop_description,
                            "type": prop_type,
                        },
                    )

                property_cache_by_id[item_property.id] = item_property
                property_cache_by_name[name_key] = item_property

            _reset_sequence(ItemProperty)

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
                raw_description = _normalize(
                    _get_entry_value(entry, HEADER_ALIASES["description"])
                )
                raw_strength = _normalize(
                    _get_entry_value(entry, HEADER_ALIASES["strength"])
                )
                if raw_strength:
                    raw_strength = raw_strength.replace(";", "").strip()
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
                raw_availabilities = _get_entry_value(
                    entry, HEADER_ALIASES["availabilities"]
                )

                if not raw_name or not raw_type:
                    skipped += 1
                    continue

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

                # Sync availabilities
                if raw_availabilities and isinstance(raw_availabilities, list):
                    _sync_availabilities(item, raw_availabilities)
                else:
                    # Backward compat: read flat cost/rarity/unique_to/variable_cost
                    raw_cost = _get_entry_value(entry, HEADER_ALIASES["cost"])
                    raw_rarity = _get_entry_value(entry, HEADER_ALIASES["rarity"])
                    raw_unique = _normalize(
                        _get_entry_value(entry, HEADER_ALIASES["unique_to"])
                    )
                    raw_variable = _normalize(
                        _get_entry_value(entry, HEADER_ALIASES["variable_cost"])
                    )
                    _sync_availabilities(
                        item,
                        [
                            {
                                "cost": raw_cost,
                                "rarity": raw_rarity,
                                "unique_to": raw_unique,
                                "variable_cost": raw_variable,
                            }
                        ],
                    )

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
                    if isinstance(raw_properties, (str, int)):
                        property_entries = [raw_properties]

                    if isinstance(property_entries, list):
                        for prop_entry in property_entries:
                            prop_id = None
                            prop_name = ""
                            prop_description = ""

                            if isinstance(prop_entry, dict):
                                prop_id = _parse_property_id(prop_entry.get("id"))
                                prop_name = _normalize(prop_entry.get("name"))
                                prop_description = _normalize(
                                    prop_entry.get("description")
                                )
                            elif isinstance(prop_entry, int):
                                prop_id = prop_entry
                            elif isinstance(prop_entry, str):
                                prop_id = _parse_property_id(prop_entry)
                                if prop_id is None:
                                    prop_name = _normalize(prop_entry)

                            item_property = None
                            if prop_id is not None:
                                item_property = property_cache_by_id.get(prop_id)
                                if not item_property:
                                    raise CommandError(
                                        f"Unknown property id {prop_id} for item '{raw_name}' in {path}"
                                    )
                            elif prop_name:
                                name_key = prop_name.lower()
                                item_property = property_cache_by_name.get(
                                    name_key
                                )
                                if not item_property:
                                    item_property = ItemProperty.objects.create(
                                        name=prop_name,
                                        description=prop_description,
                                        type=raw_type,
                                    )
                                    property_cache_by_name[
                                        name_key
                                    ] = item_property
                                    property_cache_by_id[
                                        item_property.id
                                    ] = item_property

                            if not item_property:
                                continue

                            ItemPropertyLink.objects.get_or_create(
                                item=item,
                                property=item_property,
                            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Items import complete. Created: {created}, Updated: {updated}, Skipped: {skipped}"
            )
        )
