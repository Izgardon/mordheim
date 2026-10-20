import json
import re
from pathlib import Path

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
from apps.core.seeding import read_stats
from apps.items.models import (
    Item,
    ItemAvailability,
    ItemAvailabilityRestriction,
)
from apps.restrictions.book import BookRestrictions
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell

DEFAULT_JSON_PATHS = [
    Path("apps/bestiary/data/bestiary.json"),
    Path("apps/bestiary/data/hired-swords.json"),
]

SKILL_NAME_ALIASES = {  # the Ninja's and the Knight of the White Wolf's skills under their book names (BUG-54)
    "lightning speed": "lightning reflexes",
    "leap of faith": "leap",
    "ride warhorse": "ride [animal]",
}
SPELL_PREFIX = re.compile(r"^(\d+)\s*-\s*")  # "1 - Banishment": the Dark Mage's D6 roll (BUG-54)
SPELL_DIFFICULTY = re.compile(r"^Difficulty (\d+)")

EQUIPMENT_NAME_ALIASES = {
    "horse": "riding/draft horse",  # BUG-54
    "scythe": "double-handed weapon",  # a Priest of Morr's scythe is one (BUG-54)
    "throwing knife": "throwing knives/stars",
    "throwing daggers": "throwing knives/stars",
    "throwing stars": "throwing knives/stars",
    "throwing axes": "throwing knives/stars",
    "double-handed axe": "double-handed weapon",
    "two-handed sword": "double-handed weapon",
    "brace of pistols": "pistol",
    "staff": "quarter staff",
    "rune staff": "quarter staff",
    "claws": "fighting claws",
    "repeating crossbow": "repeater crossbow",
    "dark cloak": "sea dragon cloak",
    "mining pick": "double-handed weapon",
    "pick": "double-handed weapon",
    "pickaxe": "double-handed weapon",
    "hammer": "club, mace or hammer",
    "club": "club, mace or hammer",
    "hunter's cloak": "forest cloak",
    "whip": "barbed whip",
    "scimitar": "sword",
    "longbow": "long bow",
    "shortbow": "short bow",
    "healing herbs": "healing herb",
    "gromril hammer": "gromril weapon",
    "hammer of sigmar": "sigmarite warhammer",
    "holy water": "blessed water",
    "wolf cloak": "wolfcloak",
    "fireworks": "firecrackers",
    "superior black powder": "superior blackpowder",
    "hardened leathers": "toughened leathers",
    "bo": "quarter staff",
    "rope and hook": "rope & hook",
}


def _parse_armour_save(value):
    """Extract integer from strings like '4+', '5+'. Returns None if blank or '-'."""
    if not value or str(value).strip() in ("", "-"):
        return None
    match = re.search(r"\d+", str(value))
    return int(match.group()) if match else None


def _parse_int(value, default=0):
    if isinstance(value, int):
        return value
    try:
        return int(str(value).strip())
    except (ValueError, TypeError):
        return default


def _normalize_rarity(value, default=2):
    parsed = _parse_int(value, default=default)
    return max(2, min(20, parsed))


def _normalize_lookup_key(value):
    text = str(value or "").strip()
    if not text:
        return ""
    # Normalize mixed apostrophe encodings (including mojibake) from source docs.
    text = text.replace("â€™", "'")
    text = re.sub(r"[`\u0092\u2018\u2019]", "'", text)
    text = re.sub(r"\s+", " ", text)
    return text.lower()


def _resolve_equipment_item(item_name, item_type, item_cache, item_name_cache):
    item_name_key = _normalize_lookup_key(item_name)
    alias_key = EQUIPMENT_NAME_ALIASES.get(item_name_key, item_name_key)
    item_type_key = _normalize_lookup_key(item_type)

    if item_type_key:
        item = item_cache.get((alias_key, item_type_key))
        if item:
            return item

    return item_name_cache.get(alias_key)


def _extract_name_and_description(item):
    """Return (name, description) from either a plain string or a dict; curly apostrophes in the name are
    straightened, so "Jozun’s Decay" is stored and matched as "Jozun's Decay" (BUG-54)."""
    if isinstance(item, str):
        name, description = item, ""
    elif isinstance(item, dict):
        name, description = item.get("name", ""), item.get("description", "").strip()
    else:
        return "", ""
    return re.sub(r"[`‘’]", "'", name).strip(), description


def _spell_fields(spell_item):
    """A hired sword's own spell: its name without the "N - " roll prefix, and the fields a book spell has."""
    name, description = _extract_name_and_description(spell_item)
    prefix = SPELL_PREFIX.match(name)
    difficulty = SPELL_DIFFICULTY.match(description)
    return SPELL_PREFIX.sub("", name), {
        "description": description,
        "roll": int(prefix.group(1)) if prefix else None,
        "dc": difficulty.group(1) if difficulty else "",
    }


def _sync_availabilities(item, availabilities_data, restriction_cache: BookRestrictions):
    item.availabilities.all().delete()
    if not availabilities_data:
        return
    for avail_data in availabilities_data:
        variable_cost = (avail_data.get("variable_cost") or "").strip() or None
        avail = ItemAvailability.objects.create(
            item=item,
            cost=_parse_int(avail_data.get("cost"), 0),
            rarity=_normalize_rarity(avail_data.get("rarity")),
            variable_cost=variable_cost,
        )
        unique_to_text = (avail_data.get("unique_to") or "").strip()
        if unique_to_text:
            resolved = restriction_cache.resolve(unique_to_text)
            if resolved:
                ItemAvailabilityRestriction.objects.bulk_create(
                    [
                        ItemAvailabilityRestriction(
                            item_availability=avail,
                            restriction=r,
                            additional_note=note,
                        )
                        for r, note in resolved
                    ]
                )


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
        paths = (
            [Path(p) for p in options["json_paths"]]
            if options.get("json_paths")
            else [p for p in DEFAULT_JSON_PATHS if p.exists()]
        )

        if not paths:
            self.stdout.write(self.style.WARNING("No bestiary JSON files found."))
            return

        # Lookup caches for M2M resolution: the book's entries only (BUG-17), by name with apostrophes straightened
        book = {"campaign__isnull": True, "campaign_type__isnull": True}
        skill_cache = {_normalize_lookup_key(row.name): row for row in Skill.objects.filter(**book)}
        special_cache = {_normalize_lookup_key(row.name): row for row in Special.objects.filter(**book)}
        spell_cache = {_normalize_lookup_key(row.name): row for row in Spell.objects.filter(**book)}
        item_cache: dict[tuple[str, str], Item] = {}
        item_name_cache: dict[str, Item] = {}
        for i in Item.objects.filter(**book):
            item_cache[(_normalize_lookup_key(i.name), _normalize_lookup_key(i.type))] = i
            item_name_cache.setdefault(_normalize_lookup_key(i.name), i)

        restriction_cache = BookRestrictions()

        created = 0
        updated = 0
        items_created = 0
        items_updated = 0
        hired_swords_created = 0
        hired_swords_updated = 0
        warnings = []

        with transaction.atomic():
            for path in paths:
                if not path.exists():
                    warnings.append(f"  File not found: {path}")
                    continue

                data = json.loads(path.read_text(encoding="utf-8-sig"))

                for entry_data in data:
                    name = entry_data.get("name", "").strip()
                    entry_type = entry_data.get("type", "").strip()
                    if not name or not entry_type:
                        continue

                    defaults = {
                        "description": entry_data.get("description", ""),
                        "armour_save": _parse_armour_save(entry_data.get("armour_save")),
                        "large": bool(entry_data.get("large", False)),
                        "caster": entry_data.get("caster", "No"),
                    }
                    defaults.update(read_stats(entry_data, f"Bestiary entry '{name}'"))  # fail loudly (BUG-54)

                    entry, was_created = BestiaryEntry.objects.update_or_create(
                        name=name,
                        campaign=None,
                        defaults={"type": entry_type, **defaults},
                    )

                    if was_created:
                        created += 1
                    else:
                        updated += 1

                    # Sync skills (clear + re-add for idempotency)
                    BestiaryEntrySkill.objects.filter(bestiary_entry=entry).delete()
                    for skill_name in entry_data.get("skills", []):
                        skill_key = _normalize_lookup_key(skill_name)
                        skill = skill_cache.get(SKILL_NAME_ALIASES.get(skill_key, skill_key))
                        if skill:
                            BestiaryEntrySkill.objects.create(bestiary_entry=entry, skill=skill)
                        else:
                            warnings.append(f"  Skill '{skill_name}' not found for '{name}'")

                    # Sync specials
                    BestiaryEntrySpecial.objects.filter(bestiary_entry=entry).delete()
                    for special_item in entry_data.get("specials", []):
                        special_name, special_desc = _extract_name_and_description(special_item)
                        if not special_name:
                            continue
                        cache_key = _normalize_lookup_key(special_name)
                        special = special_cache.get(cache_key)
                        if not special:
                            special = Special.objects.create(
                                name=special_name,
                                type=f"Hired Sword - {name}",
                                description=special_desc,
                                campaign=None,
                            )
                            special_cache[cache_key] = special
                            warnings.append(f"  Created special '{special_name}' (Hired Sword - {name}) for '{name}'")
                        elif special_desc and not special.description:
                            special.description = special_desc
                            special.save(update_fields=["description"])
                        BestiaryEntrySpecial.objects.create(bestiary_entry=entry, special=special)

                    # Sync spells
                    BestiaryEntrySpell.objects.filter(bestiary_entry=entry).delete()
                    for spell_item in entry_data.get("spells", []):
                        spell_name, spell_fields = _spell_fields(spell_item)
                        if not spell_name:
                            continue
                        spell = spell_cache.get(_normalize_lookup_key(spell_name))
                        if not spell:  # his own spell (the Dark Mage's six), as specials and skills are (BUG-54)
                            spell_type = f"Hired Sword - {name}"
                            spell = Spell.objects.create(name=spell_name, type=spell_type, **spell_fields)
                            spell_cache[_normalize_lookup_key(spell_name)] = spell
                            warnings.append(f"  Created spell '{spell_name}' ({spell_type}) for '{name}'")
                        BestiaryEntrySpell.objects.create(bestiary_entry=entry, spell=spell)

                    # Sync equipment items
                    BestiaryEntryItem.objects.filter(bestiary_entry=entry).delete()
                    for equip in entry_data.get("equipment", []):
                        if isinstance(equip, str):
                            equip = {"item": equip, "quantity": 1}
                        item_name = equip.get("item", "")
                        item_type = equip.get("item_type", "")
                        quantity = _parse_int(equip.get("quantity"), 1)
                        item = _resolve_equipment_item(
                            item_name=item_name,
                            item_type=item_type,
                            item_cache=item_cache,
                            item_name_cache=item_name_cache,
                        )
                        if item:
                            BestiaryEntryItem.objects.update_or_create(
                                bestiary_entry=entry, item=item, defaults={"quantity": quantity}
                            )
                        else:
                            warnings.append(f"  Equipment '{equip.get('item')}' not found for '{name}'")

                    # Create/update the corresponding Animal shop item
                    shop_item_data = entry_data.get("shop_item")
                    if shop_item_data:
                        item, item_was_created = Item.objects.update_or_create(
                            name=name,
                            type="Animal",
                            campaign=None,  # the book: never a campaign's item of the name (BUG-17)
                            campaign_type=None,
                            defaults={
                                "subtype": entry_type,
                                "grade": shop_item_data.get("grade", "1a"),
                                "single_use": bool(shop_item_data.get("single_use", False)),
                                "description": entry_data.get("description", ""),
                                "bestiary_entry": entry,
                            },
                        )
                        # a later entry may be equipped with it (the Freelancer's Warhorse, BUG-54)
                        item_cache[(_normalize_lookup_key(name), "animal")] = item
                        item_name_cache.setdefault(_normalize_lookup_key(name), item)
                        _sync_availabilities(
                            item,
                            shop_item_data.get("availabilities", []),
                            restriction_cache,
                        )
                        if item_was_created:
                            items_created += 1
                        else:
                            items_updated += 1

                    # Create/update the corresponding HiredSwordProfile record
                    hired_sword_data = entry_data.get("hired_sword")
                    if hired_sword_data:
                        hire_cost = hired_sword_data.get("hire_cost")
                        hire_cost_expr = hired_sword_data.get("hire_cost_expression", "").strip()
                        upkeep_cost = hired_sword_data.get("upkeep_cost")
                        upkeep_cost_expr = hired_sword_data.get("upkeep_cost_expression", "").strip()
                        rating = hired_sword_data.get("rating")
                        available_skill_types = list(hired_sword_data.get("available_skill_types") or [])

                        grade = hired_sword_data.get("grade", "").strip()
                        race = hired_sword_data.get("race", "").strip()

                        # Ensure special skills exist and fold their type into available_skill_types
                        special_skill_type = f"Hired Sword - {name}"
                        has_special_skills = False
                        for skill_item in hired_sword_data.get("available_special_skills", []):
                            skill_name, skill_desc = _extract_name_and_description(skill_item)
                            if not skill_name:
                                continue
                            has_special_skills = True
                            cache_key = _normalize_lookup_key(skill_name)
                            skill = skill_cache.get(cache_key)
                            if not skill:
                                skill = Skill.objects.create(
                                    name=skill_name,
                                    type=special_skill_type,
                                    description=skill_desc,
                                    campaign=None,
                                )
                                skill_cache[cache_key] = skill
                                warnings.append(f"  Created skill '{skill_name}' ({special_skill_type}) for '{name}'")
                            elif skill_desc and not skill.description:
                                skill.description = skill_desc
                                skill.save(update_fields=["description"])
                        if has_special_skills and special_skill_type not in available_skill_types:
                            available_skill_types.append(special_skill_type)

                        profile, profile_created = HiredSwordProfile.objects.update_or_create(
                            bestiary_entry=entry,
                            defaults={
                                "campaign": None,
                                "hire_cost": (_parse_int(hire_cost) if hire_cost is not None else None),
                                "hire_cost_expression": hire_cost_expr,
                                "upkeep_cost": (_parse_int(upkeep_cost) if upkeep_cost is not None else None),
                                "upkeep_cost_expression": upkeep_cost_expr,
                                "rating": (_parse_int(rating) if rating is not None else None),
                                "grade": grade,
                                "race": race,
                                "available_skill_types": available_skill_types,
                            },
                        )

                        HiredSwordProfileRestriction.objects.filter(hired_sword_profile=profile).delete()
                        unique_to_text = (hired_sword_data.get("unique_to") or "").strip()
                        if unique_to_text:
                            resolved = restriction_cache.resolve(unique_to_text)
                            if resolved:
                                HiredSwordProfileRestriction.objects.bulk_create(
                                    [
                                        HiredSwordProfileRestriction(
                                            hired_sword_profile=profile,
                                            restriction=r,
                                            additional_note=note,
                                        )
                                        for r, note in resolved
                                    ]
                                )
                        if profile_created:
                            hired_swords_created += 1
                        else:
                            hired_swords_updated += 1

        for w in warnings:
            self.stdout.write(self.style.WARNING(w))

        self.stdout.write(
            self.style.SUCCESS(
                f"Bestiary import complete. "
                f"Entries created: {created}, updated: {updated}. "
                f"Items created: {items_created}, updated: {items_updated}. "
                f"Hired swords created: {hired_swords_created}, "
                f"updated: {hired_swords_updated}."
            )
        )
