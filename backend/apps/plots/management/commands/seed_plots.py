"""Seed the book's plots from `backend/catalogue_import/sources/plots/`, read in place: each upserted by slug with
its scoring lines and its ladder written afresh (apps/plots/seeding.py). Campaign rows are never read or written; the
run is all or nothing, and it runs after the settings, whose names the plots name."""

from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core.catalogue.cache import bump
from apps.plots.seeding import seed_book_plots


class Command(BaseCommand):
    help = "Seed the book's plots from the catalogue import's sources."

    def add_arguments(self, parser):
        parser.add_argument("--sources", dest="sources", help="A folder holding the plot JSON files (tests).")

    def handle(self, *args, **options):
        folder = Path(options["sources"]) if options.get("sources") else None
        with transaction.atomic():
            result = seed_book_plots(folder) if folder else seed_book_plots()
            bump(None)  # every cached catalogue list shows the book (PERF-13)
        for skipped in result.skipped:
            self.stdout.write(self.style.WARNING(skipped))
        self.stdout.write(
            self.style.SUCCESS(
                f"Plots import complete. Plots: {result.plots}, scoring lines: {result.scoring}, "
                f"achievements: {result.achievements}, archived (no longer in the sources): {result.archived}, "
                f"skipped: {len(result.skipped)}"
            )
        )
