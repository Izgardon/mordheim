"""seed_items and the bestiary's Animal items from the catalogue import (the items rebuild): shared rules by slug,
items by name and variant with their setting, text, rules and price rows, who may buy each row, the items the import
drops archived, and a reseed keeping what owned copies cost."""

import json
from collections.abc import Iterator
from contextlib import contextmanager
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.bestiary.models import BestiaryEntry
from apps.campaigns.models import Campaign, CampaignSettings, CampaignType
from apps.items.models import Item, ItemAvailability, ItemRule
from apps.warbands.models import Hero, Warband, WarbandGroup, WarbandType

from .catalogue_support import STATS


def entry(name: str, cost: int | None = 10, **fields: Any) -> dict[str, Any]:
    """An item as out/items.json holds it: Mordheim's, one Common row for everyone at `cost`."""
    row: dict[str, Any] = {"label": "", "cost": cost, "dice": None, "dice_multiplier": None, "cost_note": ""}
    row |= {"rarity": None, "for_everyone": True, "warbands": [], "note": ""}
    return {
        "name": name,
        "variant": "",
        "type": "Weapon",
        "subtype": "Melee",
        "setting": "mordheim",
        "flavour": "",
        "source": "",
        "link_url": "",
        "tags": [],
        "notes": "",
        "range": "",
        "strength": "",
        "save": "",
        "statblock": [],
        "rules": [],
        "availabilities": [row],
        **fields,
    }


@contextmanager
def out_folder(items: list[dict[str, Any]], rules: list[dict[str, Any]] | None = None) -> Iterator[str]:
    with TemporaryDirectory() as folder:
        Path(folder, "items.json").write_text(json.dumps(items), encoding="utf-8")
        Path(folder, "item-rules.json").write_text(json.dumps(rules or []), encoding="utf-8")
        yield folder


def seed(items: list[dict[str, Any]], rules: list[dict[str, Any]] | None = None) -> str:
    output = StringIO()
    with out_folder(items, rules) as folder:
        call_command("seed_items", out=folder, stdout=output)
    return output.getvalue()


PARRY = {"slug": "parry", "name": "Parry", "summary": "Parries a blow", "text": "Parries the first blow.", "tables": []}
TABLE = {"columns": ["D6", "Result"], "rows": [["1", "Strangled"], ["2-6", "Spins on"]]}


class SeedItemsTests(TestCase):
    mordheim: CampaignType
    khemri: CampaignType
    skaven: WarbandType
    elves: WarbandGroup

    @classmethod
    def setUpTestData(cls) -> None:
        cls.mordheim = CampaignType.objects.create(slug="mordheim", name="Mordheim", grade="1a", always_on=True)
        cls.khemri = CampaignType.objects.create(slug="khemri", name="Khemri", grade="1b")
        cls.skaven = WarbandType.objects.create(name="Skaven", slug="skaven", campaign_type=cls.mordheim)
        cls.elves = WarbandGroup.objects.create(slug="elves", name="Elves", kind="race")

    def test_an_item_is_written_with_its_setting_text_rules_and_price_rows(self) -> None:
        rows = [
            {**entry("x")["availabilities"][0], "cost": 25, "dice": 2, "rarity": 9, "note": "Heroes only"},
            {**entry("x")["availabilities"][0], "label": "Brace", "cost": 200, "dice": 1, "dice_multiplier": 25},
        ]
        rows[0] |= {"for_everyone": False, "warbands": [{"type": "skaven", "excluded": False}]}
        rows[1] |= {"warbands": [{"group": "elves", "excluded": True}]}
        flail = entry(
            "Flail",
            setting="khemri",
            flavour="A spiked ball.",
            source="Town Cryer #6",
            link_url="https://mordheimer.net/flail",
            tags=["morning star"],
            strength="As user +2",
            rules=[
                {"rule": "parry", "text": "Parries, its own way."},
                {"name": "Random", "summary": "Moves 2D6", "text": "Roll:\n\n{{table:1}}", "tables": [TABLE]},
            ],
            availabilities=rows,
        )

        output = seed([flail], [PARRY])

        item = Item.objects.get(name="Flail", campaign__isnull=True)
        self.assertIn("Shared rules: 1. Items created: 1, updated: 0", output)
        self.assertEqual(
            (item.campaign_type_id, item.flavour, item.source, item.tags, item.strength),
            (self.khemri.id, "A spiked ball.", "Town Cryer #6", ["morning star"], "As user +2"),
        )
        parry = ItemRule.objects.get(slug="parry", campaign__isnull=True)
        links = list(item.rule_links.order_by("position"))
        self.assertEqual(
            [(link.rule_id, link.name, link.text, link.table) for link in links],
            [(parry.id, "", "Parries, its own way.", []), (None, "Random", "Roll:\n\n{{table:1}}", [TABLE])],
        )
        written = list(item.availabilities.order_by("id"))
        self.assertEqual(
            [
                (row.label, row.cost, row.dice, row.dice_multiplier, row.rarity, row.for_everyone, row.note)
                for row in written
            ],  # fmt: skip
            [("", 25, 2, None, 9, False, "Heroes only"), ("Brace", 200, 1, 25, None, True, "")],
        )
        self.assertEqual(
            [list(row.warband_links.values_list("warband_type_id", "warband_group_id", "excluded")) for row in written],
            [[(self.skaven.id, None, False)], [(None, self.elves.id, True)]],
        )

    def test_a_reseed_upserts_by_name_and_variant_beside_a_campaigns_item(self) -> None:
        campaign = Campaign.objects.create(name="Shards", join_code="SHARDS")
        house = Item.objects.create(name="Lamp", type="Miscellaneous", campaign=campaign, flavour="House lamp")
        seed([entry("Lamp", 50), entry("Lamp", 60, variant="Mutiny in Marienburg")])
        first = dict(Item.objects.filter(campaign__isnull=True).values_list("variant", "id"))

        seed([entry("Lamp", 55, flavour="Rubbed."), entry("Lamp", 60, variant="Mutiny in Marienburg")])

        lamps = Item.objects.filter(campaign__isnull=True, name="Lamp")
        self.assertEqual(dict(lamps.values_list("variant", "id")), first)  # updated in place
        self.assertEqual(
            sorted(lamps.values_list("variant", "flavour", "availabilities__cost")),
            [("", "Rubbed.", 55), ("Mutiny in Marienburg", "", 60)],
        )
        house.refresh_from_db()
        self.assertEqual((house.flavour, house.campaign_id), ("House lamp", campaign.id))

    def test_an_item_the_import_drops_is_archived_and_owned_copies_keep_their_cost(self) -> None:
        seed([entry("Sword", 10), entry("Ladder", 5)])
        campaign = Campaign.objects.create(name="Shards", join_code="SHARDS")
        CampaignSettings.objects.create(campaign=campaign)
        user = get_user_model().objects.create_user(username="pia@example.com", email="pia@example.com")
        warband = Warband.objects.create(campaign=campaign, user=user, name="Monks")
        hero = Hero.objects.create(warband=warband, name="Abbess", unit_type="Matriarch")
        sword = Item.objects.get(name="Sword")
        hero.hero_items.create(item=sword, cost=10)

        output = seed([entry("Sword", 14)])
        back = seed([entry("Sword", 14), entry("Ladder", 5)])

        self.assertIn("archived (no longer in the import): 1", output)
        self.assertIn("archived (no longer in the import): 0", back)
        self.assertIsNone(Item.objects.get(name="Ladder").archived_at)
        self.assertEqual(list(hero.hero_items.values_list("item_id", "cost")), [(sword.id, 10)])
        self.assertEqual(list(ItemAvailability.objects.filter(item=sword).values_list("cost", flat=True)), [14])

    def test_a_slug_the_database_lacks_stops_the_run_and_writes_nothing(self) -> None:
        row = {**entry("x")["availabilities"][0], "warbands": [{"type": "clan-moulder", "excluded": False}]}

        with self.assertRaisesMessage(CommandError, "warband type 'clan-moulder' isn't seeded"):
            seed([entry("Sword"), entry("Weeping Blades", availabilities=[row])])
        with self.assertRaisesMessage(CommandError, "Setting 'lustria' isn't seeded"):
            seed([entry("Sword", setting="lustria")])
        self.assertFalse(Item.objects.exists())

    def test_animals_are_left_to_the_bestiary(self) -> None:
        seed([entry("Warhorse", type="Animal")])
        self.assertFalse(Item.objects.exists())


class BestiaryItemsFromTheImportTests(TestCase):
    """seed_bestiary gives a book beast's Animal item the import's entry of its name; a beast the import lacks keeps
    its own shop prices, its "unique to" text as the note."""

    def test_an_imported_beast_takes_the_imports_text_rules_setting_and_prices(self) -> None:
        call_command("seed_settings", stdout=StringIO())
        call_command("seed_warband_types", stdout=StringIO())
        rows = [
            {"name": "Warhorse", "kind": "mount", **STATS, "shop_item": {"availabilities": [{"cost": 1}]}},
            {
                "name": "Polecat",
                "kind": "pet",
                **STATS,
                "shop_item": {
                    "availabilities": [{"cost": 15, "rarity": 6, "unique_to": "Halflings only", "variable_cost": "+D6"}]
                },
            },  # fmt: skip
        ]
        with TemporaryDirectory() as folder:
            path = Path(folder, "beasts.json")
            path.write_text(json.dumps(rows), encoding="utf-8")
            call_command("seed_bestiary", json_paths=[str(path)], stdout=StringIO())

        horse = BestiaryEntry.objects.get(name="Warhorse").animal_item
        self.assertEqual((horse.type, horse.subtype), ("Animal", "Mount"))  # the beast's kind, not the import's group
        self.assertTrue(horse.flavour)
        self.assertEqual(horse.campaign_type_id, CampaignType.objects.get(slug="mordheim").id)
        [row] = horse.availabilities.all()
        self.assertEqual((row.cost, row.rarity, row.for_everyone), (80, 11, False))
        self.assertTrue(row.warband_links.exists())
        self.assertTrue(horse.rule_links.exists())
        polecat = BestiaryEntry.objects.get(name="Polecat").animal_item
        [kept] = polecat.availabilities.all()
        self.assertEqual(
            (kept.cost, kept.dice, kept.rarity, kept.for_everyone, kept.note), (15, 1, 6, True, "Halflings only")
        )
        self.assertEqual(polecat.campaign_type_id, CampaignType.objects.get(slug="mordheim").id)
