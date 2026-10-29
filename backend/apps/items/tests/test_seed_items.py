import json
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.management import call_command
from django.test import TestCase

from apps.items.management.commands.seed_items import DEFAULT_JSON_PATHS
from apps.items.models import Item, ItemProperty, ItemPropertyLink

MIM_ITEMS = Path("apps/items/data/mim-items.json")


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
            )

        self.assertEqual(ItemProperty.objects.filter(name="Parry").count(), 2)

        weapon_parry = ItemProperty.objects.get(name="Parry", type="Weapon")
        armour_parry = ItemProperty.objects.get(name="Parry", type="Armour")
        sword = Item.objects.get(name="Sword", type="Weapon")
        buckler = Item.objects.get(name="Buckler", type="Armour")

        self.assertTrue(ItemPropertyLink.objects.filter(item=sword, property=weapon_parry).exists())
        self.assertTrue(ItemPropertyLink.objects.filter(item=buckler, property=armour_parry).exists())

    def test_the_unseeded_mim_items_file_links_only_properties_that_exist(self):
        # the 2026-10-28 data audit: 58 rows linked property id 0, which doesn't exist, so seed_items stopped on the
        # file with "Unknown property id 0". It stays out of seed_all until William decides on it.
        call_command("seed_items", json_path=str(MIM_ITEMS), stdout=StringIO())

        self.assertEqual(Item.objects.filter(campaign__isnull=True).count(), 62)
        caber = Item.objects.get(name="Caber", campaign__isnull=True)
        self.assertEqual(list(caber.property_links.values_list("property__name", flat=True)), ["Two-handed"])
        self.assertNotIn(MIM_ITEMS, DEFAULT_JSON_PATHS)
