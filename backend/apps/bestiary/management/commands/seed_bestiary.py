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
)
from apps.items.models import Item
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell

BESTIARY_JSON_PATH = Path("apps/bestiary/data/bestiary.json")

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


class Command(BaseCommand):
    help = "Seed bestiary entries from JSON data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--truncate",
            action="store_true",
            help="Delete existing global bestiary entries before importing.",
        )

    def handle(self, *args, **options):
        if not BESTIARY_JSON_PATH.exists():
            self.stdout.write(
                self.style.WARNING(
                    f"Bestiary JSON not found at {BESTIARY_JSON_PATH}"
                )
            )
            return

        data = json.loads(BESTIARY_JSON_PATH.read_text(encoding="utf-8-sig"))

        if options.get("truncate"):
            BestiaryEntry.objects.filter(campaign__isnull=True).delete()

        # Build lookup caches for M2M resolution
        skill_cache = {}
        for s in Skill.objects.filter(campaign__isnull=True):
            skill_cache[s.name.strip().lower()] = s

        special_cache = {}
        for s in Special.objects.filter(campaign__isnull=True):
            special_cache[s.name.strip().lower()] = s

        spell_cache = {}
        for s in Spell.objects.filter(campaign__isnull=True):
            spell_cache[s.name.strip().lower()] = s

        item_cache = {}
        for i in Item.objects.filter(campaign__isnull=True):
            key = (i.name.strip().lower(), i.type.strip().lower())
            item_cache[key] = i

        created = 0
        updated = 0
        warnings = []

        with transaction.atomic():
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
                        BestiaryEntrySkill.objects.create(
                            bestiary_entry=entry, skill=skill
                        )
                    else:
                        warnings.append(
                            f"  Skill '{skill_name}' not found for '{name}'"
                        )

                # Sync specials
                BestiaryEntrySpecial.objects.filter(bestiary_entry=entry).delete()
                for special_name in entry_data.get("specials", []):
                    special = special_cache.get(special_name.strip().lower())
                    if special:
                        BestiaryEntrySpecial.objects.create(
                            bestiary_entry=entry, special=special
                        )
                    else:
                        warnings.append(
                            f"  Special '{special_name}' not found for '{name}'"
                        )

                # Sync spells
                BestiaryEntrySpell.objects.filter(bestiary_entry=entry).delete()
                for spell_name in entry_data.get("spells", []):
                    spell = spell_cache.get(spell_name.strip().lower())
                    if spell:
                        BestiaryEntrySpell.objects.create(
                            bestiary_entry=entry, spell=spell
                        )
                    else:
                        warnings.append(
                            f"  Spell '{spell_name}' not found for '{name}'"
                        )

                # Sync equipment items
                BestiaryEntryItem.objects.filter(bestiary_entry=entry).delete()
                for equip in entry_data.get("equipment", []):
                    if isinstance(equip, str):
                        equip = {"item": equip, "item_type": "Weapon", "quantity": 1}
                    item_name = equip.get("item", "").strip().lower()
                    item_type = equip.get("item_type", "").strip().lower()
                    quantity = _parse_int(equip.get("quantity"), 1)
                    item = item_cache.get((item_name, item_type))
                    if item:
                        BestiaryEntryItem.objects.create(
                            bestiary_entry=entry, item=item, quantity=quantity
                        )
                    else:
                        warnings.append(
                            f"  Equipment '{equip.get('item')}' "
                            f"(type={equip.get('item_type')}) not found for '{name}'"
                        )

                # Back-reference: set Item.bestiary_entry FK for the shop item
                shop_item = entry_data.get("shop_item")
                if shop_item:
                    shop_name = shop_item.get("name", "").strip().lower()
                    shop_type = shop_item.get("type", "").strip().lower()
                    item = item_cache.get((shop_name, shop_type))
                    if item:
                        Item.objects.filter(id=item.id).update(bestiary_entry=entry)
                    else:
                        warnings.append(
                            f"  Shop item '{shop_item.get('name')}' "
                            f"(type={shop_item.get('type')}) not found for '{name}'"
                        )

        for w in warnings:
            self.stdout.write(self.style.WARNING(w))

        self.stdout.write(
            self.style.SUCCESS(
                f"Bestiary import complete. Created: {created}, Updated: {updated}"
            )
        )
