"""Seed the book's items from the catalogue import (`backend/catalogue_import/out/`, the items rebuild): the shared
rules (`item-rules.json`, upserted by slug), then every item but the animals (`items.json`, upserted by name and
variant) with its setting, text, rules and price rows. A beast's Animal item is the bestiary's: seed_bestiary gives
it the import's entry of its name.

A book item the import no longer lists is archived, not deleted (units, stashes and kits hold items with RESTRICT),
and an archived one the import lists again comes back. Owned copies keep the cost they were bought at. Campaign rows
are never read or written (BUG-17); the run is all or nothing. It ends by syncing every campaign's house rules
again, so their clones take the reseeded book prices (BUG-51).
"""

from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.campaigns.services.house_rules import resync_every_campaign
from apps.core.catalogue.cache import bump
from apps.core.seeding import upsert_global
from apps.items.importing import ImportedItems
from apps.items.models import ANIMAL, Item


class Command(BaseCommand):
    help = "Seed the book's items and shared item rules from the catalogue import."

    def add_arguments(self, parser):
        parser.add_argument("--out", dest="out", help="A folder holding items.json and item-rules.json (tests).")

    def handle(self, *args, **options):
        with transaction.atomic():
            imported = ImportedItems(Path(options["out"])) if options.get("out") else ImportedItems()
            rules = imported.seed_rules()
            created = updated = 0
            seen: list[int] = []
            for entry in imported.items:
                if entry["type"] == ANIMAL:
                    continue  # the bestiary's (seed_bestiary)
                item, was_created = upsert_global(
                    Item, {"name": entry["name"], "variant": entry.get("variant", "")}, imported.fields(entry)
                )
                imported.write_links(item, entry)
                seen.append(item.pk)
                created, updated = created + was_created, updated + (not was_created)
            dropped = (
                Item.objects.filter(campaign__isnull=True, archived_at__isnull=True)
                .exclude(type=ANIMAL)
                .exclude(pk__in=seen)
                .update(archived_at=timezone.now())
            )
            synced = resync_every_campaign()  # house-rule clones take the reseeded book prices (BUG-51)
            bump(None)  # every cached catalogue list shows the book (PERF-13)
        self.stdout.write(
            self.style.SUCCESS(
                f"Items import complete. Shared rules: {rules}. Items created: {created}, updated: {updated}, "
                f"archived (no longer in the import): {dropped}, house rules synced: {synced}"
            )
        )
