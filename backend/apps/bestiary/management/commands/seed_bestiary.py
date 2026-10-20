"""Seed the book's bestiary from JSON (`apps/bestiary/data/`): entries with their skills, specials, spells and
equipment, an Animal shop item for each animal sold, and a profile for each hired sword.

Links resolve against the book only (BUG-17), by name with apostrophes straightened; a hired sword's own specials,
spells and special skills are created in the book under "Hired Sword - <name>". The run is all or nothing.
"""

import re
from collections import Counter
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.bestiary.models import (
    BestiaryEntry,
    BestiaryEntryItem,
    BestiaryEntrySkill,
    BestiaryEntrySpecial,
    BestiaryEntrySpell,
    HiredSwordProfile,
    HiredSwordProfileRestriction,
)
from apps.bestiary.seeding import BookLookups
from apps.core.catalogue.cache import bump
from apps.core.seeding import clean, parse_int, read_json_list, read_stats, sync_availabilities, upsert_global
from apps.items.models import Item
from apps.restrictions.book import BookRestrictions

DEFAULT_JSON_PATHS = [
    Path("apps/bestiary/data/bestiary.json"),
    Path("apps/bestiary/data/hired-swords.json"),
]
PROFILE_COSTS = ("hire_cost", "upkeep_cost", "rating")


def _parse_armour_save(value: Any) -> int | None:
    """The number in "4+" or "5+"; None when blank or "-"."""
    if not value or str(value).strip() in ("", "-"):
        return None
    match = re.search(r"\d+", str(value))
    return int(match.group()) if match else None


def _upsert_entry(data: dict[str, Any], name: str, entry_type: str) -> tuple[BestiaryEntry, bool]:
    defaults = {
        "type": entry_type,
        "description": data.get("description", ""),
        "armour_save": _parse_armour_save(data.get("armour_save")),
        "large": bool(data.get("large", False)),
        "caster": data.get("caster", "No"),
        **read_stats(data, f"Bestiary entry '{name}'"),  # fail loudly (BUG-54)
    }
    return upsert_global(BestiaryEntry, {"name": name}, defaults)


def _sync_links(entry: BestiaryEntry, data: dict[str, Any], lookups: BookLookups) -> None:
    """The entry's skills, specials, spells and equipment become the data's (each kind in one INSERT)."""
    name = entry.name
    skills = [skill for skill_name in data.get("skills", []) if (skill := lookups.skill(skill_name, name))]
    specials = [special for item in data.get("specials", []) if (special := lookups.special(item, name))]
    spells = [spell for item in data.get("spells", []) if (spell := lookups.spell(item, name))]
    quantities: dict[int, int] = {}  # an item listed twice keeps its last quantity
    for equipment in data.get("equipment", []):
        line = {"item": equipment, "quantity": 1} if isinstance(equipment, str) else equipment
        item = lookups.equipment(line, name)
        if item:
            quantities[item.id] = parse_int(line.get("quantity"), 1)
    for model in (BestiaryEntrySkill, BestiaryEntrySpecial, BestiaryEntrySpell, BestiaryEntryItem):
        model._default_manager.filter(bestiary_entry=entry).delete()
    BestiaryEntrySkill.objects.bulk_create([BestiaryEntrySkill(bestiary_entry=entry, skill=row) for row in skills])
    BestiaryEntrySpecial.objects.bulk_create(
        [BestiaryEntrySpecial(bestiary_entry=entry, special=row) for row in specials]
    )
    BestiaryEntrySpell.objects.bulk_create([BestiaryEntrySpell(bestiary_entry=entry, spell=row) for row in spells])
    BestiaryEntryItem.objects.bulk_create(
        [BestiaryEntryItem(bestiary_entry=entry, item_id=pk, quantity=quantity) for pk, quantity in quantities.items()]
    )


def _sync_shop_item(entry: BestiaryEntry, data: dict[str, Any], lookups: BookLookups, book: BookRestrictions) -> bool:
    """The Animal item that hires the entry, with its prices; whether it is new."""
    shop = data["shop_item"]
    defaults = {
        "subtype": entry.type,
        "grade": shop.get("grade", "1a"),
        "single_use": bool(shop.get("single_use", False)),
        "description": data.get("description", ""),
        "bestiary_entry": entry,
    }
    item, created = upsert_global(Item, {"name": entry.name, "type": "Animal"}, defaults)
    lookups.remember_item(item)  # a later entry may be equipped with it (the Freelancer's Warhorse, BUG-54)
    sync_availabilities(item, shop.get("availabilities", []), book)
    return created


def _sync_hired_sword(entry: BestiaryEntry, data: dict[str, Any], lookups: BookLookups, book: BookRestrictions) -> bool:
    """The entry's hired-sword profile with its costs and restrictions; whether it is new. His special skills are
    created in the book, and their type joins the skill types he may take."""
    sword = data["hired_sword"]
    skill_types = list(sword.get("available_skill_types") or [])
    own_type = f"Hired Sword - {entry.name}"
    if lookups.special_skills(sword.get("available_special_skills", []), entry.name) and own_type not in skill_types:
        skill_types.append(own_type)
    defaults = {
        "campaign": None,
        **{field: (parse_int(sword[field]) if sword.get(field) is not None else None) for field in PROFILE_COSTS},
        "hire_cost_expression": clean(sword.get("hire_cost_expression")),
        "upkeep_cost_expression": clean(sword.get("upkeep_cost_expression")),
        "grade": clean(sword.get("grade")),
        "race": clean(sword.get("race")),
        "available_skill_types": skill_types,
    }
    profile, created = HiredSwordProfile.objects.update_or_create(bestiary_entry=entry, defaults=defaults)
    HiredSwordProfileRestriction.objects.filter(hired_sword_profile=profile).delete()
    unique_to = clean(sword.get("unique_to"))
    HiredSwordProfileRestriction.objects.bulk_create(
        [
            HiredSwordProfileRestriction(hired_sword_profile=profile, restriction=restriction, additional_note=note)
            for restriction, note in (book.resolve(unique_to) if unique_to else [])
        ]
    )
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
                f"Items created: {counts['items_created']}, updated: {counts['items_updated']}. "
                f"Hired swords created: {counts['hired_swords_created']}, "
                f"updated: {counts['hired_swords_updated']}."
            )
        )

    def _seed(self, paths: list[Path], lookups: BookLookups, book: BookRestrictions) -> Counter[str]:
        counts: Counter[str] = Counter()
        for path in paths:
            if not path.exists():
                lookups.warnings.append(f"  File not found: {path}")
                continue
            for data in read_json_list(path, "bestiary entries"):
                name, entry_type = data.get("name", "").strip(), data.get("type", "").strip()
                if not name or not entry_type:
                    continue
                entry, created = _upsert_entry(data, name, entry_type)
                counts["created" if created else "updated"] += 1
                _sync_links(entry, data, lookups)
                if data.get("shop_item"):
                    counts["items_created" if _sync_shop_item(entry, data, lookups, book) else "items_updated"] += 1
                if data.get("hired_sword"):
                    new_sword = _sync_hired_sword(entry, data, lookups, book)
                    counts["hired_swords_created" if new_sword else "hired_swords_updated"] += 1
        return counts
