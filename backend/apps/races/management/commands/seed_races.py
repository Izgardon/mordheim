import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.races.models import Race

DEFAULT_JSON_PATH = Path("apps/races/data/races.json")
FALLBACK_JSON_PATHS = [DEFAULT_JSON_PATH, Path("csvs/races.json")]

HEADER_ALIASES = {
    "name": ["name", "profile", "race"],
    "movement": ["movement", "m"],
    "weapon_skill": ["weapon_skill", "weapon skill", "ws"],
    "ballistic_skill": ["ballistic_skill", "ballistic skill", "bs"],
    "strength": ["strength", "s"],
    "toughness": ["toughness", "t"],
    "wounds": ["wounds", "w"],
    "initiative": ["initiative", "i"],
    "attacks": ["attacks", "a"],
    "leadership": ["leadership", "ld", "lead"],
}


def _normalize(value):
    return str(value or "").strip()


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
    help = "Seed races from JSON data."

    def add_arguments(self, parser):
        parser.add_argument("--json", dest="json_path", help="Path to a JSON file.")
        parser.add_argument(
            "--truncate",
            action="store_true",
            help="Delete existing races before importing.",
        )

    def handle(self, *args, **options):
        json_path = options.get("json_path")
        truncate = options.get("truncate")

        if truncate:
            Race.objects.all().delete()

        path = Path(json_path) if json_path else _resolve_default_json_path()
        if not path or not path.exists():
            raise CommandError(
                "JSON file not found. Provide --json or place data at apps/races/data/races.json or csvs/races.json."
            )

        try:
            data = json.loads(path.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError as exc:
            raise CommandError(f"Unable to parse JSON: {exc}") from exc

        if not isinstance(data, list):
            raise CommandError("JSON data should be a list of race objects.")

        created = 0
        updated = 0
        skipped = 0

        for entry in data:
            name = _normalize(_get_entry_value(entry, HEADER_ALIASES["name"]))
            if not name:
                skipped += 1
                continue

            fields = {
                "movement": _normalize(
                    _get_entry_value(entry, HEADER_ALIASES["movement"])
                ),
                "weapon_skill": _normalize(
                    _get_entry_value(entry, HEADER_ALIASES["weapon_skill"])
                ),
                "ballistic_skill": _normalize(
                    _get_entry_value(entry, HEADER_ALIASES["ballistic_skill"])
                ),
                "strength": _normalize(
                    _get_entry_value(entry, HEADER_ALIASES["strength"])
                ),
                "toughness": _normalize(
                    _get_entry_value(entry, HEADER_ALIASES["toughness"])
                ),
                "wounds": _normalize(
                    _get_entry_value(entry, HEADER_ALIASES["wounds"])
                ),
                "initiative": _normalize(
                    _get_entry_value(entry, HEADER_ALIASES["initiative"])
                ),
                "attacks": _normalize(
                    _get_entry_value(entry, HEADER_ALIASES["attacks"])
                ),
                "leadership": _normalize(
                    _get_entry_value(entry, HEADER_ALIASES["leadership"])
                ),
                "campaign": None,
            }

            if not any(fields.values()):
                skipped += 1
                continue

            race = Race.objects.filter(name=name, campaign__isnull=True).first()
            if race:
                for key, value in fields.items():
                    setattr(race, key, value)
                race.save()
                updated += 1
            else:
                Race.objects.create(name=name, **fields)
                created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Races import complete. Created: {created}, Updated: {updated}, Skipped: {skipped}"
            )
        )
