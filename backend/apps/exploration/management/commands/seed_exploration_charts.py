"""Seed the book's exploration charts from `backend/catalogue_import/sources/exploration/`, read in place: each
upserted by slug with its places written afresh (apps/exploration/seeding.py). Campaign rows are never read or
written; the run is all or nothing, and it runs after the settings, whose names the charts name."""

from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core.catalogue.cache import bump
from apps.exploration.seeding import seed_book_charts


class Command(BaseCommand):
    help = "Seed the book's exploration charts from the catalogue import's sources."

    def add_arguments(self, parser):
        parser.add_argument("--sources", dest="sources", help="A folder holding the chart JSON files (tests).")

    def handle(self, *args, **options):
        folder = Path(options["sources"]) if options.get("sources") else None
        with transaction.atomic():
            result = seed_book_charts(folder) if folder else seed_book_charts()
            bump(None)  # every cached catalogue list shows the book (PERF-13)
        for skipped in result.skipped:
            self.stdout.write(self.style.WARNING(skipped))
        self.stdout.write(
            self.style.SUCCESS(
                f"Exploration charts import complete. Charts: {result.charts}, places: {result.places}, "
                f"archived (no longer in the sources): {result.archived}, skipped: {len(result.skipped)}"
            )
        )
