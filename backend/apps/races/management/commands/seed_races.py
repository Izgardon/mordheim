"""Seed the book's races from JSON (`apps/races/data/races.json`, `csvs/races.json`, or --json).

Campaign rows are never read or written (BUG-17); the run is all or nothing; there is no --truncate (BUG-16,
BUG-130: it deleted every race and every unit of one). Every stat must be there: a missing one stops the run with
the race's name (BUG-54).
"""

from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.core.seeding import STAT_FIELDS, clean, entry_value, read_json_list, read_stats, upsert_global
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


class Command(BaseCommand):
    help = "Seed races from JSON data."

    def add_arguments(self, parser):
        parser.add_argument("--json", dest="json_path", help="Path to a JSON file.")

    def handle(self, *args, **options):
        """Upsert the book's races by name, all or nothing (BUG-17)."""
        with transaction.atomic():
            self._import(options)

    def _import(self, options):
        json_path = options.get("json_path")
        path = Path(json_path) if json_path else next((p for p in FALLBACK_JSON_PATHS if p.exists()), None)
        if not path or not path.exists():
            raise CommandError(
                "JSON file not found. Provide --json or place data at apps/races/data/races.json or csvs/races.json."
            )

        created = updated = skipped = 0
        for entry in read_json_list(path, "race objects"):
            name = clean(entry_value(entry, HEADER_ALIASES["name"]))
            if not name:
                skipped += 1
                continue
            raw = {field: entry_value(entry, HEADER_ALIASES[field]) for field in STAT_FIELDS}
            _, was_created = upsert_global(Race, {"name": name}, read_stats(raw, f"Race '{name}'"))
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(
            self.style.SUCCESS(f"Races import complete. Created: {created}, Updated: {updated}, Skipped: {skipped}")
        )
