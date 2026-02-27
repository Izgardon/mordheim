import json
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
    HiredSwordProfileAvailableSkill,
    HiredSwordProfileRestriction,
)
from apps.items.models import (
    Item,
    ItemAvailability,
    ItemAvailabilityRestriction,
)
from apps.restrictions.models import Restriction
from apps.restrictions.utils import parse_unique_to
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell

DEFAULT_JSON_PATHS = [
    Path("apps/bestiary/data/bestiary.json"),
    Path("apps/bestiary/data/hired-swords.json"),
]

STAT_FIELDS = [
    "movement",
    "weapon_skill",
    "ballistic_skill",
    "strength",
    "toughness",
    "wounds",
    "initiative",
    "attacks",
    "leadership",
]


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


def _resolve_restrictions(unique_to_text, restriction_cache):
    parsed = parse_unique_to(unique_to_text)
    results = []
    for entry in parsed:
        cache_key = entry["restriction"]
        restriction = restriction_cache.get(cache_key)
        if not restriction:
            restriction, _ = Restriction.objects.get_or_create(
                restriction=entry["restriction"],
                defaults={"type": entry["type"]},
            )
            restriction_cache[cache_key] = restriction
        results.append((restriction, entry["additional_note"]))
    return results


def _extract_name_and_description(item):
    """Return (name, description) from either a plain string or a dict."""
    if isinstance(item, str):
        return item.strip(), ""
    if isinstance(item, dict):
        return item.get("name", "").strip(), item.get("description", "").strip()
    return "", ""


def _sync_availabilities(item, availabilities_data, restriction_cache):
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
            resolved = _resolve_restrictions(unique_to_text, restriction_cache)
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
        parser.add_argument(
            "--truncate",
            action="store_true",
            help="Delete existing global bestiary entries before importing.",
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

        if options.get("truncate"):
            BestiaryEntry.objects.filter(campaign__isnull=True).delete()

        # Build lookup caches for M2M resolution
        skill_cache: dict[str, Skill] = {}
        for s in Skill.objects.filter(campaign__isnull=True):
            skill_cache[s.name.strip().lower()] = s

        special_cache: dict[str, Special] = {}
        for sp in Special.objects.filter(campaign__isnull=True):
            special_cache[sp.name.strip().lower()] = sp

        spell_cache: dict[str, Spell] = {}
        for sl in Spell.objects.filter(campaign__isnull=True):
            spell_cache[sl.name.strip().lower()] = sl

        item_cache: dict[tuple[str, str], Item] = {}
        item_name_cache: dict[str, Item] = {}
        for i in Item.objects.filter(campaign__isnull=True):
            key = (i.name.strip().lower(), i.type.strip().lower())
            item_cache[key] = i
            item_name_cache.setdefault(i.name.strip().lower(), i)

        restriction_cache = {}
        for r in Restriction.objects.all():
            restriction_cache[r.restriction] = r

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
                        "armour_save": entry_data.get("armour_save", ""),
                        "large": bool(entry_data.get("large", False)),
                        "caster": entry_data.get("caster", "No"),
                    }
                    for field in STAT_FIELDS:
                        defaults[field] = _parse_int(entry_data.get(field), 0)

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
                        skill = skill_cache.get(skill_name.strip().lower())
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
                        cache_key = special_name.lower()
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
                        spell_name, _ = _extract_name_and_description(spell_item)
                        if not spell_name:
                            continue
                        spell = spell_cache.get(spell_name.lower())
                        if spell:
                            BestiaryEntrySpell.objects.create(bestiary_entry=entry, spell=spell)
                        else:
                            warnings.append(f"  Spell '{spell_name}' not found for '{name}'")

                    # Sync equipment items
                    BestiaryEntryItem.objects.filter(bestiary_entry=entry).delete()
                    for equip in entry_data.get("equipment", []):
                        if isinstance(equip, str):
                            equip = {"item": equip, "quantity": 1}
                        item_name = equip.get("item", "").strip().lower()
                        item_type = equip.get("item_type", "").strip().lower() if equip.get("item_type") else ""
                        quantity = _parse_int(equip.get("quantity"), 1)
                        if item_type:
                            item = item_cache.get((item_name, item_type))
                        else:
                            item = item_name_cache.get(item_name)
                        if item:
                            BestiaryEntryItem.objects.create(bestiary_entry=entry, item=item, quantity=quantity)
                        else:
                            warnings.append(f"  Equipment '{equip.get('item')}' not found for '{name}'")

                    # Create/update the corresponding Animal shop item
                    shop_item_data = entry_data.get("shop_item")
                    if shop_item_data:
                        item, item_was_created = Item.objects.update_or_create(
                            name=name,
                            type="Animal",
                            defaults={
                                "subtype": entry_type,
                                "grade": shop_item_data.get("grade", "1a"),
                                "single_use": bool(shop_item_data.get("single_use", False)),
                                "description": entry_data.get("description", ""),
                                "bestiary_entry": entry,
                            },
                        )
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
                        available_skill_types = hired_sword_data.get("available_skill_types") or {}

                        grade = hired_sword_data.get("grade", "").strip()

                        profile, profile_created = HiredSwordProfile.objects.update_or_create(
                            bestiary_entry=entry,
                            defaults={
                                "campaign": None,
                                "hire_cost": (_parse_int(hire_cost) if hire_cost is not None else None),
                                "hire_cost_expression": hire_cost_expr,
                                "upkeep_cost": (_parse_int(upkeep_cost) if upkeep_cost is not None else None),
                                "upkeep_cost_expression": upkeep_cost_expr,
                                "grade": grade,
                                "available_skill_types": available_skill_types,
                            },
                        )

                        # Sync available special skills
                        HiredSwordProfileAvailableSkill.objects.filter(hired_sword_profile=profile).delete()
                        for skill_item in hired_sword_data.get("available_special_skills", []):
                            skill_name, skill_desc = _extract_name_and_description(skill_item)
                            if not skill_name:
                                continue
                            cache_key = skill_name.lower()
                            skill = skill_cache.get(cache_key)
                            if not skill:
                                skill = Skill.objects.create(
                                    name=skill_name,
                                    type=f"Hired Sword - {name}",
                                    description=skill_desc,
                                    campaign=None,
                                )
                                skill_cache[cache_key] = skill
                                warnings.append(f"  Created skill '{skill_name}' (Hired Sword - {name}) for '{name}'")
                            elif skill_desc and not skill.description:
                                skill.description = skill_desc
                                skill.save(update_fields=["description"])
                            HiredSwordProfileAvailableSkill.objects.create(hired_sword_profile=profile, skill=skill)

                        HiredSwordProfileRestriction.objects.filter(hired_sword_profile=profile).delete()
                        unique_to_text = (hired_sword_data.get("unique_to") or "").strip()
                        if unique_to_text:
                            resolved = _resolve_restrictions(unique_to_text, restriction_cache)
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
