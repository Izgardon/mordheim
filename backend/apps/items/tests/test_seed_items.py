import json
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.management import call_command
from django.test import TestCase

from apps.items.models import Item, ItemProperty, ItemPropertyLink


class SeedItemsCommandTests(TestCase):
    def test_seed_items_allows_same_property_name_for_different_types(self):
        properties_payload = [
            {
                "id": 1,
                "name": "Parry",
                "description": "Weapon parry rule.",
                "type": "Weapon",
            },
            {
                "id": 2,
                "name": "Parry",
                "description": "Armour parry rule.",
                "type": "Armour",
            },
        ]
        items_payload = [
            {
                "name": "Sword",
                "type": "Weapon",
                "subtype": "Melee",
                "cost": 10,
                "rarity": 2,
                "properties": ["Parry"],
            },
            {
                "name": "Buckler",
                "type": "Armour",
                "subtype": "Shield",
                "cost": 5,
                "rarity": 2,
                "properties": ["Parry"],
            },
        ]

        with TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            properties_path = temp_path / "item-properties.json"
            items_path = temp_path / "items.json"
            properties_path.write_text(json.dumps(properties_payload), encoding="utf-8")
            items_path.write_text(json.dumps(items_payload), encoding="utf-8")

            call_command(
                "seed_items",
                json_path=str(items_path),
                properties_path=str(properties_path),
                truncate=True,
            )

        self.assertEqual(ItemProperty.objects.filter(name="Parry").count(), 2)

        weapon_parry = ItemProperty.objects.get(name="Parry", type="Weapon")
        armour_parry = ItemProperty.objects.get(name="Parry", type="Armour")
        sword = Item.objects.get(name="Sword", type="Weapon")
        buckler = Item.objects.get(name="Buckler", type="Armour")

        self.assertTrue(ItemPropertyLink.objects.filter(item=sword, property=weapon_parry).exists())
        self.assertTrue(ItemPropertyLink.objects.filter(item=buckler, property=armour_parry).exists())
