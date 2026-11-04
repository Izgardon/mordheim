"""Seed the book's warband templates from the catalogue import (`backend/catalogue_import/out/warband-templates.json`,
the templates plan phase 1b): each upserted by slug with its warband types, rules, lists, fighters and upgrades
written afresh (apps/warband_templates/seeding.py). Campaign rows are never read or written; the run is all or
nothing, and runs after the settings, warband types, races, items, the bestiary's animals and the specials."""

from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core.catalogue.cache import bump
from apps.warband_templates.models import WarbandTemplateType
from apps.warband_templates.seeding import BookRows, archive_dropped, read_templates, write_template


class Command(BaseCommand):
    help = "Seed the book's warband templates from the catalogue import."

    def add_arguments(self, parser):
        parser.add_argument("--out", dest="out", help="A folder holding warband-templates.json (tests).")

    def handle(self, *args, **options):
        entries = read_templates(Path(options["out"])) if options.get("out") else read_templates()
        with transaction.atomic():
            book = BookRows()
            WarbandTemplateType.objects.filter(campaign__isnull=True).delete()  # a type may move between templates
            seen = [write_template(entry, book).pk for entry in entries]
            templates, specials = archive_dropped(seen, book)
            bump(None)  # every cached catalogue list shows the book (PERF-13)
        self.stdout.write(
            self.style.SUCCESS(
                f"Warband templates import complete. Templates: {len(seen)}, archived (no longer in the import): "
                f"{templates}; their own specials archived: {specials}"
            )
        )
