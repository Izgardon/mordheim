import json
import re
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.items.models import Item

DEFAULT_JSON_PATH = Path("apps/items/data/items.json")
FALLBACK_JSON_PATHS = [DEFAULT_JSON_PATH, Path("csvs/items.json")]

HEADER_ALIASES = {
    "name": ["name", "item"],
    "type": ["type", "category"],
    "cost": ["cost", "price"],
    "rarity": ["rarity", "availability", "avail"],
    "unique_to": ["unique_to", "unique"],
    "description": ["description", "desc", "details"],
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


def _resolve_default_json_path():
    for path in FALLBACK_JSON_PATHS:
        if path.exists():
            return path
    return None


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
            Item.objects.all().delete()

        path = Path(json_path) if json_path else _resolve_default_json_path()
        if not path or not path.exists():
            raise CommandError(
                "JSON file not found. Provide --json or place data at apps/items/data/items.json or csvs/items.json."
            )

        try:
            data = json.loads(path.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError as exc:
            raise CommandError(f"Unable to parse JSON: {exc}") from exc

        if not isinstance(data, list):
            raise CommandError("JSON data should be a list of item objects.")

        created = 0
        updated = 0
        skipped = 0

        for entry in data:
            raw_name = _normalize(_get_entry_value(entry, HEADER_ALIASES["name"]))
            raw_type = _normalize(_get_entry_value(entry, HEADER_ALIASES["type"]))
            raw_cost = _get_entry_value(entry, HEADER_ALIASES["cost"])
            raw_rarity = _get_entry_value(entry, HEADER_ALIASES["rarity"])
            raw_unique = _normalize(
                _get_entry_value(entry, HEADER_ALIASES["unique_to"])
            )
            raw_description = _normalize(
                _get_entry_value(entry, HEADER_ALIASES["description"])
            )

            if not raw_name or not raw_type:
                skipped += 1
                continue

            cost_value = _parse_int(raw_cost)
            rarity_value = _normalize_rarity(raw_rarity)

            _, was_created = Item.objects.update_or_create(
                name=raw_name,
                type=raw_type,
                defaults={
                    "cost": cost_value,
                    "rarity": rarity_value,
                    "unique_to": raw_unique,
                    "description": raw_description,
                },
            )

            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Items import complete. Created: {created}, Updated: {updated}, Skipped: {skipped}"
            )
        )
