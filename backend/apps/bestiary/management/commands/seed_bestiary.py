"""Seed the book's bestiary from JSON (`apps/bestiary/data/bestiary.json`, Mutiny in Marienburg's
`mim-bestiary.json` and Border Town Burning's Beasts of the East, `btb-bestiary.json`): the beasts, each a mount, a pet
or a creature (`kind`), with its profile (a stat as the book writes it, "-" or "5*", kept as written), whether it has
one (`has_profile`: off, its stats are kept at 0 and its save empty), gains XP, what it adds to a rider's rating
(`rating_bonus`) and whether the shop sells it (`available_in_shop`); their skills, specials, spells and equipment;
and every beast's Animal item, listed when it is sold. A beast the catalogue import has (`out/items.json`, the items
rebuild) takes its item's text, rules, setting and price rows from there; any other keeps the prices of its
`shop_item` (open to everyone, a "unique to" text as the note) and its `setting`, else its setting by its file and
grade. Hired swords and dramatis personae are their own catalogue (seed_hired_swords, seed_dramatis_personae).

Links resolve against the book only (BUG-17), by name with apostrophes straightened. The run is all or nothing: an
entry without a known kind, or with a rating bonus that isn't a whole number from 0, stops it.
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
from apps.bestiary.writes import NO_PROFILE
from apps.core.book_lookups import BookLookups
from apps.core.catalogue.cache import bump
from apps.core.seeding import clean, parse_armour_save, read_json_list, read_written_stats, upsert_global
from apps.items.importing import ImportedItems, legacy_rows, mordheim_part
from apps.items.models import ANIMAL, Item
from apps.items.writes import replace_availabilities
from apps.special.models import Special
from apps.special.owners import mark_beast_rules
from apps.special.prebattle import SPECIAL, mark_book_rolls

DEFAULT_JSON_PATHS = [
    Path("apps/bestiary/data/bestiary.json"),
    Path("apps/bestiary/data/mim-bestiary.json"),
    Path("apps/bestiary/data/btb-bestiary.json"),
]
MIM = "mutiny-in-marienburg"


def _kind(data: dict[str, Any], name: str) -> str:
    kind = str(data.get("kind") or "").strip().lower()
    if kind not in SUBTYPES:
        raise CommandError(f"Bestiary entry '{name}' needs a kind ({', '.join(SUBTYPES)}), not {data.get('kind')!r}")
    return kind


def _rating_bonus(data: dict[str, Any], name: str) -> int | None:
    bonus = data.get("rating_bonus")
    if bonus is not None and (isinstance(bonus, bool) or not isinstance(bonus, int) or bonus < 0):
        raise CommandError(f"Bestiary entry '{name}': rating_bonus is {bonus!r}, not a whole number from 0 or null")
    return bonus


def _upsert_entry(data: dict[str, Any], name: str, kind: str) -> tuple[BestiaryEntry, bool]:
    has_profile = bool(data.get("has_profile", True))
    defaults = {
        "kind": kind,
        "description": data.get("description", ""),
        "armour_save": parse_armour_save(data.get("armour_save")),
        "large": bool(data.get("large", False)),
        "caster": data.get("caster", "No"),
        "has_profile": has_profile,
        "gains_xp": bool(data.get("gains_xp", False)),
        "rating_bonus": _rating_bonus(data, name),
        "available_in_shop": bool(data.get("available_in_shop", False)),
        **read_written_stats(data, f"Bestiary entry '{name}'"),  # as written ("-", "5*"); fail loudly (BUG-54)
        **({} if has_profile else NO_PROFILE),
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


class ItemSource:
    """Where a seeded beast's Animal item takes its text, setting and prices from: the import's entry of its name, else
    the beast's own shop data. The import's entries name settings and warband types, so they are used once those are
    seeded (seed_all seeds them first); a bestiary seeded on its own keeps the shop data."""

    def __init__(self) -> None:
        self.imported = ImportedItems()
        seeded = bool(self.imported.settings and self.imported.types)
        if seeded:
            self.imported.seed_rules()  # the shared rules the animals name, upserted by slug as seed_items does
        self.animals = self.imported.animals() if seeded else {}

    def write(self, item: Item, entry: BestiaryEntry, data: dict[str, Any], path: Path) -> None:
        found = self.animals.get(entry.name.strip().lower())
        if found is not None:  # the beast keeps its item's name, kind (subtype) and listing
            self.imported.apply(item, found, keep=("type", "subtype"))
            return
        shop = data.get("shop_item") or {}
        setting = clean(data.get("setting")) or (
            MIM if path.name.startswith("mim-") else mordheim_part(clean(shop.get("grade")) or "1a")
        )
        fields = {"flavour": entry.description, "campaign_type_id": self.imported.settings.get(setting)}
        Item.objects.filter(pk=item.pk).update(**fields)
        replace_availabilities(item, legacy_rows(shop.get("availabilities", [])))


def _adopt_book_item(entry: BestiaryEntry) -> None:
    """A book item of the beast's name that no beast holds becomes its Animal item, rather than a second row of that
    name: the Magic Carpet was a Miscellaneous item until the Khemri equipment page made it a mount (11 Nov 2026)."""
    if entry.campaign_id is not None:
        return
    Item.objects.filter(campaign__isnull=True, name=entry.name, bestiary_entry__isnull=True).update(
        bestiary_entry=entry, type=ANIMAL, subtype=SUBTYPES[entry.kind]
    )


def _sync_item(
    entry: BestiaryEntry, data: dict[str, Any], lookups: BookLookups, source: ItemSource, path: Path
) -> bool:
    """The beast's Animal item (every beast has one), with its text, setting and prices; whether it is new."""
    _adopt_book_item(entry)
    created = not Item.objects.filter(bestiary_entry=entry).exists()
    item = sync_item(entry, {})
    lookups.remember_item(item)  # a later entry may be equipped with it (the Freelancer's Warhorse, BUG-54)
    source.write(item, entry, data, path)
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
            counts = self._seed(paths, lookups, ItemSource())
            mark_book_rolls(Special, SPECIAL)  # a beast's own specials' pre-battle rolls (special/prebattle.py)
            mark_beast_rules()  # a rule only beasts hold leaves Boons & Banes (special/owners.py)
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

    def _seed(self, paths: list[Path], lookups: BookLookups, source: ItemSource) -> Counter[str]:
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
                counts["items_created" if _sync_item(entry, data, lookups, source, path) else "items_updated"] += 1
        return counts
