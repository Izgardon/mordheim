"""Deleting catalogue entries that something holds (pass 5; BUG-16, BUG-130, CAT-TEST-04, CAT-TWEAK-04, CAT-TEST-25).

Owned copies (unit items, skills, spells and specials, stash rows), the bestiary's link tables and units' races
reference the catalogue with RESTRICT since PR A (they were CASCADE: a delete took every copy in every warband, with
no refund, and a race took every unit of it). PR A answered a delete of an entry in use with 409 `in_use`; since PR
C (decision 5) it archives the entry instead, answering its usage, and every copy stays. Deleting a whole campaign
still cascades.
"""

import json
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.management import call_command
from django.db import transaction
from django.db.models import RestrictedError

from apps.bestiary.models import (
    BestiaryEntryItem,
    BestiaryEntrySkill,
    BestiaryEntrySpecial,
    BestiaryEntrySpell,
    WarbandBestiaryFavourite,
)
from apps.core.catalogue import kinds as catalogue_kinds
from apps.core.catalogue.usage import count_usage
from apps.items.models import Item
from apps.items.services import HALF_PRICE_ARMOUR_EFFECT_KEY as HALF
from apps.races.models import Race
from apps.warbands.models import HenchmenGroup, Hero, Hireling, Warband, WarbandItem, WarbandTrade
from apps.warbands.tests.roster_support import HENCHMEN, HERO, HIRELING, make_unit

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


def archived(**usage: int) -> dict[str, object]:
    """The answer to a delete that archived the entry (it was the 409 in_use body before PR C)."""
    return {"outcome": "archived", "usage": {**usage, "hired_swords": 0, "dramatis_personae": 0}}


class CustomEntryDeleteTests(CatalogueTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.hero = make_unit(HERO, self.warband, name="Abbess")
        self.group = make_unit(HENCHMEN, self.rival_warband, name="Rats")
        self.sword = make_unit(HIRELING, self.rival_warband, name="Ogre")
        self.beast = make_entry(BESTIARY, "War Boar", campaign=self.campaign)

    def ledger(self) -> list[tuple[int, str, int]]:
        rows = WarbandTrade.objects.filter(warband__campaign=self.campaign).order_by("id")
        return list(rows.values_list("warband_id", "action", "price"))

    def test_deleting_a_custom_item_in_use_archives_it_with_its_usage_and_keeps_every_copy(self):
        # BUG-16, CAT-TEST-04 (was pinned: the delete took every copy in every warband, with no refund; flipped in
        # PR A: copies are RESTRICT and the delete answered 409 in_use; PR C, decision 5: it archives the item)
        charm = make_entry(ITEMS, "Lucky Charm", campaign=self.campaign, cost=25)
        self.hero.hero_items.create(item=charm, cost=25)
        self.group.henchmen_group_items.create(item=charm, cost=25)
        self.sword.hireling_items.create(item=charm, cost=25)
        WarbandItem.objects.create(warband=self.warband, item=charm, quantity=2, cost=25)
        BestiaryEntryItem.objects.create(bestiary_entry=self.beast, item=charm)
        ledger, gold = self.ledger(), list(Warband.objects.order_by("id").values_list("gold", flat=True))

        response = self.delete_as(self.owner, ITEMS.detail_url(charm.id))

        self.assertEqual(
            (response.status_code, response.json()),
            (200, archived(units=3, warbands=2, stashes=1, bestiary_entries=1)),
        )
        self.assertIsNotNone(Item.objects.get(id=charm.id).archived_at)
        self.assertEqual(
            [
                self.hero.hero_items.count(),
                self.group.henchmen_group_items.count(),
                self.sword.hireling_items.count(),
            ],
            [1, 1, 1],
        )
        self.assertTrue(WarbandItem.objects.filter(warband=self.warband, item=charm).exists())
        self.assertTrue(BestiaryEntryItem.objects.filter(bestiary_entry=self.beast, item=charm).exists())
        self.assertEqual(self.ledger(), ledger)
        self.assertEqual(list(Warband.objects.order_by("id").values_list("gold", flat=True)), gold)

    def test_a_dead_units_copy_still_counts_and_an_unused_entry_is_deleted(self):
        charm = make_entry(ITEMS, "Lucky Charm", campaign=self.campaign)
        self.hero.hero_items.create(item=charm, cost=25)
        Hero.objects.filter(id=self.hero.id).update(dead=True)  # soft-deleted units keep their records
        spare = make_entry(ITEMS, "Spare Charm", campaign=self.campaign)

        refused = self.delete_as(self.owner, ITEMS.detail_url(charm.id))
        deleted = self.delete_as(self.owner, ITEMS.detail_url(spare.id))

        self.assertEqual((refused.status_code, refused.json()["usage"]["units"]), (200, 1))  # archived
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(Item.objects.filter(id=spare.id).exists())

    def test_deleting_a_custom_skill_spell_or_special_in_use_archives_it_and_keeps_every_link(self):
        # BUG-16 (was pinned: the delete took it from every unit and bestiary entry; flipped in PR A)
        skill = make_entry(SKILLS, "Ambush", campaign=self.campaign)
        spell = make_entry(SPELLS, "Gloom", campaign=self.campaign)
        special = make_entry(SPECIALS, "Fearsome", campaign=self.campaign)
        for unit, kind in ((self.hero, HERO), (self.group, HENCHMEN), (self.sword, HIRELING)):
            getattr(unit, kind.skills).create(skill=skill)
            getattr(unit, kind.specials).create(special=special)
            if kind.spells:
                getattr(unit, kind.spells).create(spell=spell)
        BestiaryEntrySkill.objects.create(bestiary_entry=self.beast, skill=skill)
        BestiaryEntrySpell.objects.create(bestiary_entry=self.beast, spell=spell)
        BestiaryEntrySpecial.objects.create(bestiary_entry=self.beast, special=special)

        answers = [
            self.delete_as(self.owner, kind.detail_url(entry.id))
            for kind, entry in ((SKILLS, skill), (SPELLS, spell), (SPECIALS, special))
        ]

        self.assertEqual(
            [(answer.status_code, answer.json()) for answer in answers],
            [
                (200, archived(units=3, warbands=2, stashes=0, bestiary_entries=1)),
                (200, archived(units=2, warbands=2, stashes=0, bestiary_entries=1)),  # henchmen have no spells
                (200, archived(units=3, warbands=2, stashes=0, bestiary_entries=1)),
            ],
        )
        for unit, kind in ((self.hero, HERO), (self.group, HENCHMEN), (self.sword, HIRELING)):
            with self.subTest(kind=kind.key):
                relations = [kind.skills, kind.specials, *([kind.spells] if kind.spells else [])]
                self.assertEqual([getattr(unit, relation).count() for relation in relations], [1] * len(relations))
        self.assertEqual(
            [
                model.objects.filter(bestiary_entry=self.beast).count()
                for model in (BestiaryEntrySkill, BestiaryEntrySpell, BestiaryEntrySpecial)
            ],  # fmt: skip
            [1, 1, 1],
        )

    def test_deleting_a_bestiary_entry_drops_its_favourites_and_takes_its_item(self):
        # the bestiary rewrite step 3 (was: the shop item was unlinked and stayed): an Animal item is its beast's
        WarbandBestiaryFavourite.objects.create(warband=self.warband, bestiary_entry=self.beast)
        boar = make_entry(ITEMS, "War Boar", campaign=self.campaign, type="Animal", bestiary_entry=self.beast)

        self.assertEqual(self.delete_as(self.owner, BESTIARY.detail_url(self.beast.id)).status_code, 204)

        self.assertFalse(WarbandBestiaryFavourite.objects.filter(warband=self.warband).exists())
        self.assertFalse(Item.objects.filter(pk=boar.pk).exists())

    def test_deleting_a_hired_sword_leaves_the_units_hired_from_it(self):
        hired_sword = make_entry(HIRED_SWORDS, "Ogre Bodyguard", campaign=self.campaign)

        self.assertEqual(self.delete_as(self.owner, HIRED_SWORDS.detail_url(hired_sword.id)).status_code, 204)

        self.assertTrue(Hireling.objects.filter(id=self.sword.id).exists())  # a hireling is a copy: no link back

    def test_deleting_the_last_copy_holder_leaves_the_catalogue_entry(self):
        charm = make_entry(ITEMS, "Lucky Charm", campaign=self.campaign)
        self.hero.hero_items.create(item=charm, cost=25)

        self.hero.delete()

        self.assertTrue(Item.objects.filter(id=charm.id).exists())


class RaceDeleteTests(CatalogueTestCase):
    """BUG-130: units reference their race with CASCADE (`heroes.py:9-15`, `henchmen.py:9-15`, `hirelings.py:9-15`)."""

    def setUp(self) -> None:
        super().setUp()
        self.halfling = make_entry(RACES, "Halfling", campaign=self.campaign)
        self.hero = make_unit(HERO, self.warband, name="Abbess", race=self.human)
        self.group = make_unit(HENCHMEN, self.rival_warband, name="Cooks", race=self.halfling)
        self.sword = make_unit(HIRELING, self.warband, name="Scout", race=self.human)
        self.raceless = make_unit(HERO, self.warband, name="Stranger")

    def surviving_units(self) -> list[str]:
        return sorted(
            [*Hero.objects.values_list("name", flat=True), *HenchmenGroup.objects.values_list("name", flat=True)]
            + list(Hireling.objects.values_list("name", flat=True))
        )

    def test_a_race_in_use_cannot_be_deleted_and_its_units_stay(self):
        # BUG-130 (was pinned: deleting a race deleted every unit of it; flipped in PR A: units' races are RESTRICT)
        with self.assertRaises(RestrictedError), transaction.atomic():
            Race.objects.filter(id=self.human.id).delete()

        self.assertEqual(self.surviving_units(), ["Abbess", "Cooks", "Scout", "Stranger"])
        usage = count_usage(catalogue_kinds.RACES, self.human.id, self.campaign.id)
        self.assertEqual(
            usage,
            {"units": 2, "warbands": 1, "stashes": 0, "bestiary_entries": 0, "hired_swords": 0, "dramatis_personae": 0},
        )  # a hero and a hired sword

    def test_reseeding_races_keeps_every_race_and_every_unit_of_one(self):
        # BUG-130, BUG-16 (was pinned: seed_races --truncate deleted every race and every unit with one; flipped in
        # PR A: --truncate is gone, and the upsert updates the book's Human in place)
        with TemporaryDirectory() as folder:
            path = Path(folder) / "races.json"
            path.write_text(json.dumps([{"name": "Human", **STATS}]), encoding="utf-8")
            with self.assertRaises(TypeError):
                call_command("seed_races", json_path=str(path), truncate=True, stdout=StringIO())
            call_command("seed_races", json_path=str(path), stdout=StringIO())

        self.assertEqual(self.surviving_units(), ["Abbess", "Cooks", "Scout", "Stranger"])
        self.assertCountEqual(Race.objects.values_list("name", "campaign_id"), [("Human", None), ("Halfling", self.campaign.id)])  # fmt: skip
        self.assertEqual(Race.objects.get(name="Human").id, self.human.id)

    def test_a_race_in_use_is_archived_through_the_api_and_an_unused_one_is_deleted(self):
        # BUG-82, BUG-130: races gained a DELETE in PR A (delete_catalogue), with the in-use rule
        gnome = make_entry(RACES, "Gnome", campaign=self.campaign)

        refused = self.delete_as(self.owner, RACES.detail_url(self.halfling.id))
        deleted = self.delete_as(self.owner, RACES.detail_url(gnome.id))

        self.assertEqual((refused.status_code, refused.json()), (200, archived(units=1, warbands=1, stashes=0, bestiary_entries=0)))  # fmt: skip
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(self.surviving_units(), ["Abbess", "Cooks", "Scout", "Stranger"])


class CampaignDeleteTests(CatalogueTestCase):
    """RESTRICT, not PROTECT: pass 4's permanent campaign delete still takes everything in it (decision 5)."""

    def test_deleting_an_archived_campaign_takes_its_custom_entries_and_every_copy(self):
        race = make_entry(RACES, "Halfling", campaign=self.campaign)
        charm = make_entry(ITEMS, "Lucky Charm", campaign=self.campaign)
        skill = make_entry(SKILLS, "Ambush", campaign=self.campaign)
        spell = make_entry(SPELLS, "Gloom", campaign=self.campaign)
        special = make_entry(SPECIALS, "Fearsome", campaign=self.campaign)
        beast = make_entry(BESTIARY, "War Boar", campaign=self.campaign)
        hero = make_unit(HERO, self.warband, name="Cook", race=race)
        group = make_unit(HENCHMEN, self.rival_warband, name="Cooks", race=race)
        hero.hero_items.create(item=charm, cost=5)
        hero.hero_items.create(item=self.book_axe, cost=5)
        hero.hero_skills.create(skill=skill)
        hero.hero_spells.create(spell=spell)
        group.henchmen_group_specials.create(special=special)
        WarbandItem.objects.create(warband=self.warband, item=charm, quantity=1, cost=5)
        BestiaryEntryItem.objects.create(bestiary_entry=beast, item=charm)
        BestiaryEntrySkill.objects.create(bestiary_entry=beast, skill=skill)
        self.assertEqual(self.post_as(self.owner, self.url("archive/")).status_code, 200)
        self.client.force_authenticate(user=self.owner)

        response = self.client.delete(self.url(), {"name": "Shards"}, format="json")

        self.assertEqual(response.status_code, 204)
        for entry in (race, charm, skill, spell, special, beast, hero, group):
            with self.subTest(entry=str(entry)):
                self.assertFalse(type(entry).objects.filter(id=entry.id).exists())
        self.assertTrue(Item.objects.filter(id=self.book_axe.id).exists())
        self.assertTrue(Race.objects.filter(id=self.human.id).exists())


class HouseRuleRevertTests(CatalogueTestCase):
    """A rule's clone can't go while something holds it, so reverting a rule hands bestiary equipment back too."""

    def test_reverting_a_rule_returns_a_bestiary_entrys_clone_to_the_book_item(self):
        rule = self.post_as(self.owner, self.url("rules/"), {"title": "Half price", "effect_key": HALF})
        clone = Item.objects.get(campaign=self.campaign, replaces=self.heavy_armour)
        mule = make_entry(BESTIARY, "Mule", campaign=self.campaign)
        knight = make_entry(BESTIARY, "Knight", campaign=self.campaign)
        BestiaryEntryItem.objects.create(bestiary_entry=mule, item=clone, quantity=2)
        BestiaryEntryItem.objects.create(bestiary_entry=knight, item=clone)
        BestiaryEntryItem.objects.create(bestiary_entry=knight, item=self.heavy_armour)

        response = self.delete_as(self.owner, self.url(f"rules/{rule.data['id']}/"))

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Item.objects.filter(id=clone.id).exists())
        equipped = BestiaryEntryItem.objects.filter(bestiary_entry__in=[mule, knight]).order_by("bestiary_entry__name")
        self.assertEqual(
            list(equipped.values_list("bestiary_entry__name", "item_id", "quantity")),
            [("Knight", self.heavy_armour.id, 1), ("Mule", self.heavy_armour.id, 2)],
        )
