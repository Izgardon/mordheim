"""Seed the book's scenarios and the settings' scenario tables from `backend/catalogue_import/out/scenarios.json`,
read in place (apps/scenarios/seeding.py). Campaign rows are never read or written; the run is all or nothing, and
it runs after the settings, whose names the tables name."""

from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core.catalogue.cache import bump
from apps.scenarios.seeding import seed_book_scenarios


class Command(BaseCommand):
    help = "Seed the book's scenarios from the catalogue import."

    def add_arguments(self, parser):
        parser.add_argument("--source", dest="source", help="A scenarios JSON file (tests).")

    def handle(self, *args, **options):
        with transaction.atomic():
            result = seed_book_scenarios(Path(options["source"])) if options.get("source") else seed_book_scenarios()
            bump(None)  # every cached catalogue list shows the book (PERF-13)
        for skipped in result.skipped:
            self.stdout.write(self.style.WARNING(skipped))
        self.stdout.write(
            self.style.SUCCESS(
                f"Scenarios import complete. Scenarios: {result.scenarios}, setting scenarios: "
                f"{result.setting_links}, archived (no longer in the import): {result.archived}, "
                f"skipped: {len(result.skipped)}"
            )
        )
