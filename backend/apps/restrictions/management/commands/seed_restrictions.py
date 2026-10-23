"""Seed the book's restrictions from JSON (`apps/restrictions/data/restrictions.json`, or --json).

Rows are matched by text and type in the book only (BUG-17); the run is all or nothing; there is no --truncate
(BUG-16: it deleted campaign restrictions, their links and every campaign's item settings).
"""

from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.core.catalogue.cache import bump
from apps.core.seeding import read_json_list, reset_sequence, upsert_global
from apps.restrictions.models import Restriction

DEFAULT_JSON_PATH = Path("apps/restrictions/data/restrictions.json")


class Command(BaseCommand):
    help = "Seed restrictions from JSON data."

    def add_arguments(self, parser):
        parser.add_argument("--json", dest="json_path", help="Path to a JSON file.")

    def handle(self, *args, **options):
        """Upsert the book's restrictions by text and type, all or nothing (BUG-17)."""
        with transaction.atomic():
            self._import(options)
            bump(None)  # every cached catalogue list shows the book (PERF-13)

    def _import(self, options):
        path = Path(options.get("json_path") or DEFAULT_JSON_PATH)
        if not path.exists():
            raise CommandError(f"JSON file not found: {path}")

        created = updated = 0
        for entry in read_json_list(path):
            restriction_type = entry.get("type", "Warband").strip()
            restriction_text = entry.get("restriction", "").strip()
            if not restriction_text:
                continue
            _, was_created = upsert_global(Restriction, {"restriction": restriction_text, "type": restriction_type}, {})
            if was_created:
                created += 1
            else:
                updated += 1

        reset_sequence(Restriction)
        self.stdout.write(self.style.SUCCESS(f"Restrictions import complete. Created: {created}, Updated: {updated}"))
