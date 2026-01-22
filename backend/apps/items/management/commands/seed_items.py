import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.items.models import Item

DEFAULT_JSON_PATH = Path("apps/items/data/items.json")
FALLBACK_JSON_PATHS = [DEFAULT_JSON_PATH, Path("csvs/items.json")]

HEADER_ALIASES = {
    "name": ["name", "item"],
    "type": ["type", "category"],
    "cost": ["cost", "price"],
    "availability": ["availability", "avail"],
    "unique_to": ["unique_to", "unique"],
    "custom": ["custom", "is_custom"],
}


def _normalize(value):
    return str(value or "").strip()


def _normalize_bool(value):
    cleaned = _normalize(value).lower()
    return cleaned in {"1", "true", "yes", "y", "t"}


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
            raw_cost = _normalize(_get_entry_value(entry, HEADER_ALIASES["cost"]))
            raw_availability = _normalize(
                _get_entry_value(entry, HEADER_ALIASES["availability"])
            )
            raw_unique = _normalize(
                _get_entry_value(entry, HEADER_ALIASES["unique_to"])
            )
            raw_custom = _get_entry_value(entry, HEADER_ALIASES["custom"])
            custom_value = _normalize_bool(raw_custom)

            if not raw_name or not raw_type:
                skipped += 1
                continue

            _, was_created = Item.objects.update_or_create(
                name=raw_name,
                type=raw_type,
                defaults={
                    "cost": raw_cost,
                    "availability": raw_availability,
                    "unique_to": raw_unique,
                    "custom": custom_value,
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
