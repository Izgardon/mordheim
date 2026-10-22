"""Every write that names a catalogue entry lands on the campaign's current version of it (pass 5 PR C;
CAT-TWEAK-03, CAT-TEST-26).

A book id the campaign has a version of stands for the version, in the query each write already ran: unit creates
and PATCHes (a hire preset copied from a bestiary entry, a full list resent), stash adds and moves, bestiary links,
an item's animal and favourites. A campaign entry that merely shares the name, of any type, changes nothing.
"""

from apps.bestiary.models import BestiaryEntry, WarbandBestiaryFavourite
from apps.warbands.models import HiredSword, WarbandItem
from apps.warbands.tests.roster_support import HERO, HIRED_SWORD, create_payload, make_unit, unit_url

from .catalogue_support import BESTIARY, ITEMS, RACES, SKILLS, SPECIALS, SPELLS, CatalogueTestCase, make_entry


class WriteResolutionTests(CatalogueTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.client.force_authenticate(user=self.player)
        self.skill = make_entry(SKILLS, "Hiding", campaign=self.campaign, type="Skaven", replaces=self.infiltration[2])
        self.spell = make_entry(SPELLS, "Life drain", campaign=self.campaign, type="Necromancy", replaces=self.lifestealer[0])  # fmt: skip
        self.special = make_entry(SPECIALS, "Huge", campaign=self.campaign, type="Trait", replaces=self.large)
        self.sword = make_entry(ITEMS, "Sword", campaign=self.campaign, cost=30, replaces=self.book_sword)
        self.race = make_entry(RACES, "Humans", campaign=self.campaign, replaces=self.human)

    def test_a_hire_preset_of_book_ids_hires_with_the_campaigns_versions(self):
        payload = create_payload(
            HIRED_SWORD,
            race=self.human.id,
            skill_ids=[self.infiltration[2].id, self.skill.id],  # a stale list and a fresh one: the skill once
            special_ids=[self.large.id],
            spell_ids=[self.lifestealer[0].id],
            items=[{"id": self.book_sword.id}],
        )

        response = self.client.post(unit_url(HIRED_SWORD, self.warband.id), payload, format="json")

        self.assertEqual(response.status_code, 201, response.data)
        unit = HiredSword.objects.get(id=response.data["id"])
        self.assertEqual(unit.race_id, self.race.id)
        self.assertEqual(list(unit.hired_sword_skills.values_list("skill_id", flat=True)), [self.skill.id])
        self.assertEqual(list(unit.hired_sword_spells.values_list("spell_id", flat=True)), [self.spell.id])
        self.assertIn(self.special.id, unit.hired_sword_specials.values_list("special_id", flat=True))
        self.assertEqual(list(unit.hired_sword_items.values_list("item_id", "cost")), [(self.sword.id, 30)])

    def test_a_full_list_patch_resending_book_ids_keeps_the_versions(self):
        hero = make_unit(HERO, self.warband)

        body = {"skill_ids": [self.infiltration[2].id], "items": [{"id": self.book_sword.id, "cost": 12}]}
        response = self.client.patch(unit_url(HERO, self.warband.id, hero.id), body, format="json")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(list(hero.hero_skills.values_list("skill_id", flat=True)), [self.skill.id])
        self.assertEqual(list(hero.hero_items.values_list("item_id", "cost")), [(self.sword.id, 12)])

    def test_a_same_named_entry_of_another_type_changes_nothing(self):
        make_entry(SKILLS, "Infiltration", campaign=self.campaign, type="Combat")
        hero = make_unit(HERO, self.warband)

        self.client.patch(unit_url(HERO, self.warband.id, hero.id), {"skill_ids": [self.infiltration[0].id]}, format="json")  # fmt: skip

        self.assertEqual(list(hero.hero_skills.values_list("skill_id", flat=True)), [self.infiltration[0].id])

    def test_a_stash_add_and_a_move_naming_the_book_id_use_the_version(self):
        added = self.client.post(f"/api/warbands/{self.warband.id}/items/", {"item_id": self.book_sword.id, "cost": 30}, format="json")  # fmt: skip
        hero = make_unit(HERO, self.warband)
        hero.hero_items.create(item=self.sword, cost=30)
        body = {
            "item_id": self.book_sword.id,
            "source_type": "hero",
            "source_id": hero.id,
            "target_type": "stash",
            "quantity": 1,
        }
        moved = self.client.post(f"/api/warbands/{self.warband.id}/item-transfers/", body, format="json")

        self.assertEqual((added.status_code, added.data["id"]), (201, self.sword.id))
        self.assertEqual(moved.status_code, 200, moved.data)
        self.assertEqual(list(WarbandItem.objects.filter(warband=self.warband).values_list("item_id", "quantity")), [(self.sword.id, 2)])  # fmt: skip

    def test_the_catalogues_own_links_point_at_the_versions(self):
        version_hound = make_entry(BESTIARY, "Hound", campaign=self.campaign, replaces=self.warhound)
        body = BESTIARY.body(
            "Boar", self.campaign, skill_ids=[self.infiltration[2].id], item_entries=[self.book_sword.id]
        )
        entry = self.post_as(self.player, BESTIARY.list_url(), body)
        animal = self.post_as(self.player, ITEMS.list_url(), ITEMS.body("Hound leash", self.campaign, type="Animal", bestiary_entry_id=self.warhound.id))  # fmt: skip
        favourite = self.post_as(self.player, f"/api/warbands/{self.warband.id}/bestiary-favourites/", {"bestiary_entry_id": self.warhound.id})  # fmt: skip

        self.assertEqual((entry.status_code, animal.status_code, favourite.status_code), (201, 201, 201))
        boar = BestiaryEntry.objects.get(id=entry.data["id"])
        self.assertEqual(list(boar.bestiary_entry_skills.values_list("skill_id", flat=True)), [self.skill.id])
        self.assertEqual(list(boar.bestiary_entry_items.values_list("item_id", flat=True)), [self.sword.id])
        self.assertEqual(animal.data["bestiary_entry"]["id"], version_hound.id)
        self.assertEqual(list(WarbandBestiaryFavourite.objects.filter(warband=self.warband).values_list("bestiary_entry_id", flat=True)), [version_hound.id])  # fmt: skip

    def test_unfavouriting_by_the_book_id_removes_the_versions_favourite(self):
        version_hound = make_entry(BESTIARY, "Hound", campaign=self.campaign, replaces=self.warhound)
        WarbandBestiaryFavourite.objects.create(warband=self.warband, bestiary_entry=version_hound)

        response = self.client.delete(f"/api/warbands/{self.warband.id}/bestiary-favourites/{self.warhound.id}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(WarbandBestiaryFavourite.objects.filter(warband=self.warband).exists())
