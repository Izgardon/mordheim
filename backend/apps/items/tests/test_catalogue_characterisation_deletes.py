"""Characterisation: deleting catalogue entries deletes what references them (pass 5; BUG-16, BUG-130, CAT-TEST-04).

Owned copies (unit items, skills, spells and specials, stash rows), the bestiary's link tables and units' races all
reference the catalogue with CASCADE. Deleting a custom entry deletes every copy in every warband of the campaign,
with no refund, ledger row or notice; deleting a race deletes every unit of that race. PR A makes them RESTRICT and
answers 409 `in_use` with counts; PR C archives an entry in use instead (decision 5).
"""

import json
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.management import call_command

from apps.bestiary.models import (
    BestiaryEntryItem,
    BestiaryEntrySkill,
    BestiaryEntrySpecial,
    BestiaryEntrySpell,
    WarbandBestiaryFavourite,
)
from apps.items.models import Item
from apps.races.models import Race
from apps.warbands.models import HenchmenGroup, Hero, HiredSword, Warband, WarbandItem, WarbandTrade
from apps.warbands.tests.roster_support import HENCHMEN, HERO, HIRED_SWORD, make_unit

from .catalogue_support import (
    BESTIARY,
    HIRED_SWORDS,
    ITEMS,
    RACES,
    SKILLS,
    SPECIALS,
    SPELLS,
    STATS,
    CatalogueTestCase,
    make_entry,
)


class CustomEntryDeleteTests(CatalogueTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.hero = make_unit(HERO, self.warband, name="Abbess")
        self.group = make_unit(HENCHMEN, self.rival_warband, name="Rats")
        self.sword = make_unit(HIRED_SWORD, self.rival_warband, name="Ogre")
        self.beast = make_entry(BESTIARY, "War Boar", campaign=self.campaign)

    def ledger(self) -> list[tuple[int, str, int]]:
        rows = WarbandTrade.objects.filter(warband__campaign=self.campaign).order_by("id")
        return list(rows.values_list("warband_id", "action", "price"))

    def test_deleting_a_custom_item_deletes_every_copy_in_every_warband_without_a_refund(self):
        # Characterises current behaviour (BUG-16, CAT-TEST-04, pinned; flips in PR A: 409 in_use, copies untouched)
        charm = make_entry(ITEMS, "Lucky Charm", campaign=self.campaign, cost=25)
        self.hero.hero_items.create(item=charm, cost=25)
        self.group.henchmen_group_items.create(item=charm, cost=25)
        self.sword.hired_sword_items.create(item=charm, cost=25)
        WarbandItem.objects.create(warband=self.warband, item=charm, quantity=2, cost=25)
        BestiaryEntryItem.objects.create(bestiary_entry=self.beast, item=charm)
        ledger, gold = self.ledger(), list(Warband.objects.order_by("id").values_list("gold", flat=True))

        response = self.delete_as(self.owner, ITEMS.detail_url(charm.id))

        self.assertEqual(response.status_code, 204)
        self.assertEqual(
            [
                self.hero.hero_items.count(),
                self.group.henchmen_group_items.count(),
                self.sword.hired_sword_items.count(),
            ],
            [0, 0, 0],
        )
        self.assertFalse(WarbandItem.objects.filter(warband=self.warband).exists())
        self.assertFalse(BestiaryEntryItem.objects.filter(bestiary_entry=self.beast).exists())
        self.assertEqual(self.ledger(), ledger)
        self.assertEqual(list(Warband.objects.order_by("id").values_list("gold", flat=True)), gold)

    def test_deleting_a_custom_skill_spell_or_special_takes_it_from_every_unit_and_bestiary_entry(self):
        # Characterises current behaviour (BUG-16, pinned; flips in PR A)
        skill = make_entry(SKILLS, "Ambush", campaign=self.campaign)
        spell = make_entry(SPELLS, "Gloom", campaign=self.campaign)
        special = make_entry(SPECIALS, "Fearsome", campaign=self.campaign)
        for unit, kind in ((self.hero, HERO), (self.group, HENCHMEN), (self.sword, HIRED_SWORD)):
            getattr(unit, kind.skills).create(skill=skill)
            getattr(unit, kind.specials).create(special=special)
            if kind.spells:
                getattr(unit, kind.spells).create(spell=spell)
        BestiaryEntrySkill.objects.create(bestiary_entry=self.beast, skill=skill)
        BestiaryEntrySpell.objects.create(bestiary_entry=self.beast, spell=spell)
        BestiaryEntrySpecial.objects.create(bestiary_entry=self.beast, special=special)

        statuses = [
            self.delete_as(self.owner, kind.detail_url(entry.id)).status_code
            for kind, entry in ((SKILLS, skill), (SPELLS, spell), (SPECIALS, special))
        ]

        self.assertEqual(statuses, [204, 204, 204])
        for unit, kind in ((self.hero, HERO), (self.group, HENCHMEN), (self.sword, HIRED_SWORD)):
            with self.subTest(kind=kind.key):
                relations = [kind.skills, kind.specials, *([kind.spells] if kind.spells else [])]
                self.assertEqual([getattr(unit, relation).count() for relation in relations], [0] * len(relations))
        self.assertEqual(
            [
                model.objects.filter(bestiary_entry=self.beast).count()
                for model in (BestiaryEntrySkill, BestiaryEntrySpell, BestiaryEntrySpecial)
            ],  # fmt: skip
            [0, 0, 0],
        )

    def test_deleting_a_bestiary_entry_drops_its_favourites_and_unlinks_its_shop_item(self):
        WarbandBestiaryFavourite.objects.create(warband=self.warband, bestiary_entry=self.beast)
        boar = make_entry(ITEMS, "War Boar", campaign=self.campaign, type="Animal", bestiary_entry=self.beast)

        self.assertEqual(self.delete_as(self.owner, BESTIARY.detail_url(self.beast.id)).status_code, 204)

        self.assertFalse(WarbandBestiaryFavourite.objects.filter(warband=self.warband).exists())
        boar.refresh_from_db()
        self.assertIsNone(boar.bestiary_entry_id)

    def test_deleting_a_hired_sword_leaves_the_units_hired_from_it(self):
        profile = make_entry(HIRED_SWORDS, "Ogre Bodyguard", campaign=self.campaign)

        self.assertEqual(self.delete_as(self.owner, HIRED_SWORDS.detail_url(profile.id)).status_code, 204)

        self.assertTrue(HiredSword.objects.filter(id=self.sword.id).exists())  # a hired sword copies its profile

    def test_deleting_the_last_copy_holder_leaves_the_catalogue_entry(self):
        charm = make_entry(ITEMS, "Lucky Charm", campaign=self.campaign)
        self.hero.hero_items.create(item=charm, cost=25)

        self.hero.delete()

        self.assertTrue(Item.objects.filter(id=charm.id).exists())


class RaceDeleteTests(CatalogueTestCase):
    """BUG-130: units reference their race with CASCADE (`heroes.py:9-15`, `henchmen.py:9-15`, `hired_swords.py:9-15`)."""

    def setUp(self) -> None:
        super().setUp()
        self.halfling = make_entry(RACES, "Halfling", campaign=self.campaign)
        self.hero = make_unit(HERO, self.warband, name="Abbess", race=self.human)
        self.group = make_unit(HENCHMEN, self.rival_warband, name="Cooks", race=self.halfling)
        self.sword = make_unit(HIRED_SWORD, self.warband, name="Scout", race=self.human)
        self.raceless = make_unit(HERO, self.warband, name="Stranger")

    def surviving_units(self) -> list[str]:
        return sorted(
            [*Hero.objects.values_list("name", flat=True), *HenchmenGroup.objects.values_list("name", flat=True)]
            + list(HiredSword.objects.values_list("name", flat=True))
        )

    def test_deleting_a_race_deletes_every_unit_of_that_race(self):
        # Characterises current behaviour (BUG-130, pinned; flips in PR A: RESTRICT, and a delete answers 409 in_use)
        Race.objects.filter(id=self.human.id).delete()

        self.assertEqual(self.surviving_units(), ["Cooks", "Stranger"])

    def test_seed_races_truncate_deletes_every_race_and_every_unit_with_one(self):
        # Characterises current behaviour (BUG-130, BUG-16, pinned; flips in PR A: --truncate goes from the seeders)
        with TemporaryDirectory() as folder:
            path = Path(folder) / "races.json"
            path.write_text(json.dumps([{"name": "Human", **STATS}]), encoding="utf-8")
            call_command("seed_races", json_path=str(path), truncate=True, stdout=StringIO())

        self.assertEqual(self.surviving_units(), ["Stranger"])
        self.assertEqual(list(Race.objects.values_list("name", "campaign_id")), [("Human", None)])
        self.assertNotEqual(Race.objects.get().id, self.human.id)

    def test_a_race_cannot_be_deleted_through_the_api(self):
        self.assertEqual(self.delete_as(self.owner, RACES.detail_url(self.halfling.id)).status_code, 405)
        self.assertEqual(self.surviving_units(), ["Abbess", "Cooks", "Scout", "Stranger"])
