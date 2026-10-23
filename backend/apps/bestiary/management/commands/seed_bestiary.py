"""Seed the book's bestiary from JSON (`apps/bestiary/data/bestiary.json`): the beasts, each a mount, a pet or a
creature (`kind`), with their skills, specials, spells and equipment, and every beast's Animal item (listed in the
shop when `available_in_shop`, with the grade and prices of its `shop_item`). Hired swords and dramatis personae are their own catalogue (seed_hired_swords, seed_dramatis_personae).

Links resolve against the book only (BUG-17), by name with apostrophes straightened. The run is all or nothing: an
entry without a known kind stops it.
"""

from collections import Counter
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.bestiary.animal_items import SUBTYPES, sync_item
from apps.bestiary.models import (
    BestiaryEntry,
    BestiaryEntryItem,
    BestiaryEntrySkill,
    BestiaryEntrySpecial,
    BestiaryEntrySpell,
)
from apps.core.book_lookups import BookLookups
from apps.core.catalogue.cache import bump
from apps.core.seeding import clean, parse_armour_save, read_json_list, read_stats, sync_availabilities, upsert_global
from apps.items.models import Item
from apps.restrictions.book import BookRestrictions

DEFAULT_JSON_PATHS = [Path("apps/bestiary/data/bestiary.json")]


def _kind(data: dict[str, Any], name: str) -> str:
    kind = str(data.get("kind") or "").strip().lower()
    if kind not in SUBTYPES:
        raise CommandError(f"Bestiary entry '{name}' needs a kind ({', '.join(SUBTYPES)}), not {data.get('kind')!r}")
    return kind


def _upsert_entry(data: dict[str, Any], name: str, kind: str) -> tuple[BestiaryEntry, bool]:
    defaults = {
        "kind": kind,
        "description": data.get("description", ""),
        "armour_save": parse_armour_save(data.get("armour_save")),
        "large": bool(data.get("large", False)),
        "caster": data.get("caster", "No"),
        "available_in_shop": bool(data.get("available_in_shop", False)),
        **read_stats(data, f"Bestiary entry '{name}'"),  # fail loudly (BUG-54)
    }
    return upsert_global(BestiaryEntry, {"name": name}, defaults)


def _sync_links(entry: BestiaryEntry, data: dict[str, Any], lookups: BookLookups) -> None:
    """The entry's skills, specials, spells and equipment become the data's (each kind in one INSERT)."""
    links = lookups.links(data, entry.name)
    for model in (BestiaryEntrySkill, BestiaryEntrySpecial, BestiaryEntrySpell, BestiaryEntryItem):
        model._default_manager.filter(bestiary_entry=entry).delete()
    BestiaryEntrySkill.objects.bulk_create(
        [BestiaryEntrySkill(bestiary_entry=entry, skill=row) for row in links.skills]
    )
    BestiaryEntrySpecial.objects.bulk_create(
        [BestiaryEntrySpecial(bestiary_entry=entry, special=row) for row in links.specials]
    )
    BestiaryEntrySpell.objects.bulk_create(
        [BestiaryEntrySpell(bestiary_entry=entry, spell=row) for row in links.spells]
    )
    BestiaryEntryItem.objects.bulk_create(
        [
            BestiaryEntryItem(bestiary_entry=entry, item_id=pk, quantity=quantity)
            for pk, quantity in links.quantities.items()
        ]
    )


def _sync_item(entry: BestiaryEntry, data: dict[str, Any], lookups: BookLookups, book: BookRestrictions) -> bool:
    """The beast's Animal item (every beast has one), with its grade and prices; whether it is new."""
    shop = data.get("shop_item") or {}
    created = not Item.objects.filter(bestiary_entry=entry).exists()
    item = sync_item(entry, {"grade": clean(shop.get("grade")) or "1a"})
    lookups.remember_item(item)  # a later entry may be equipped with it (the Freelancer's Warhorse, BUG-54)
    sync_availabilities(item, shop.get("availabilities", []), book)
    return created


class Command(BaseCommand):
    help = "Seed bestiary entries from JSON data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--json",
            dest="json_paths",
            action="append",
            help="Path to a bestiary JSON file. May be specified multiple times.",
        )

    def handle(self, *args, **options):
        if options.get("json_paths"):
            paths = [Path(path) for path in options["json_paths"]]
        else:
            paths = [path for path in DEFAULT_JSON_PATHS if path.exists()]
        if not paths:
            self.stdout.write(self.style.WARNING("No bestiary JSON files found."))
            return

        lookups = BookLookups()
        with transaction.atomic():
            counts = self._seed(paths, lookups, BookRestrictions())
            bump(None)  # every cached catalogue list shows the book (PERF-13)

        for warning in lookups.warnings:
            self.stdout.write(self.style.WARNING(warning))
        self.stdout.write(
            self.style.SUCCESS(
                f"Bestiary import complete. "
                f"Entries created: {counts['created']}, updated: {counts['updated']}. "
                f"Items created: {counts['items_created']}, updated: {counts['items_updated']}."
            )
        )

    def _seed(self, paths: list[Path], lookups: BookLookups, book: BookRestrictions) -> Counter[str]:
        counts: Counter[str] = Counter()
        for path in paths:
            if not path.exists():
                lookups.warnings.append(f"  File not found: {path}")
                continue
            for data in read_json_list(path, "bestiary entries"):
                name = data.get("name", "").strip()
                if not name:
                    continue
                entry, created = _upsert_entry(data, name, _kind(data, name))
                counts["created" if created else "updated"] += 1
                _sync_links(entry, data, lookups)
                counts["items_created" if _sync_item(entry, data, lookups, book) else "items_updated"] += 1
        return counts
