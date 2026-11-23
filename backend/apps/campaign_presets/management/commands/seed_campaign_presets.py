"""Seed the campaign presets from `backend/catalogue_import/sources/campaign-presets/`, read in place: each upserted
by slug with its settings and its rules written afresh (apps/campaign_presets/seeding.py). The run is all or
nothing, and it runs after the settings and the exploration charts, whose names and slugs the presets name."""

from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.campaign_presets.seeding import seed_presets
from apps.core.catalogue.cache import bump


class Command(BaseCommand):
    help = "Seed the campaign presets (Mordheim, Mutiny in Marienburg …) from the catalogue import's sources."

    def add_arguments(self, parser):
        parser.add_argument("--sources", dest="sources", help="A folder holding the preset JSON files (tests).")

    def handle(self, *args, **options):
        folder = Path(options["sources"]) if options.get("sources") else None
        with transaction.atomic():
            result = seed_presets(folder) if folder else seed_presets()
            bump(None)  # the settings a preset ticks change what every cached catalogue list says is in play
        for skipped in result.skipped:
            self.stdout.write(self.style.WARNING(skipped))
        self.stdout.write(
            self.style.SUCCESS(
                f"Campaign presets import complete. Presets: {result.presets}, rules: {result.rules}, "
                f"charts: {result.charts}, locations: {result.locations}, warband rules: {result.warband_rules}, "
                f"skipped: {len(result.skipped)}"
            )
        )
