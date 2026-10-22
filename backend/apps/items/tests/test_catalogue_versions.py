"""Editing a book entry makes the campaign's version of it; Revert takes it back (pass 5 PR C; decisions 1 and 2,
CAT-TWEAK-01, CAT-TEST-23).

`PATCH <kind>/<book id>/` with the campaign's id copies the book entry and its child rows into the campaign
(`replaces` set), moves the campaign's copies onto the copy with their stored costs, and applies the edit; later
edits change the version in place. `POST <kind>/<id>/revert/` moves the copies back and deletes the version. Other
campaigns, and the book, are untouched. Both cost the same whatever the number of copies.
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.bestiary.models import BestiaryEntry, BestiaryEntryItem, BestiaryEntrySkill, WarbandBestiaryFavourite
from apps.core.models import RevertedVersion
from apps.items.models import Item
from apps.skills.models import Skill
from apps.warbands.models import Warband, WarbandItem
from apps.warbands.tests.roster_support import HENCHMEN, HERO, HIRED_SWORD, make_unit

from .catalogue_support import BESTIARY, HIRED_SWORDS, ITEMS, RACES, SKILLS, CatalogueTestCase, make_entry


class VersionTestCase(CatalogueTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.hero = make_unit(HERO, self.warband, name="Abbess")
        self.group = make_unit(HENCHMEN, self.rival_warband, name="Rats")
        self.sword_unit = make_unit(HIRED_SWORD, self.rival_warband, name="Ogre")
        self.beast = make_entry(BESTIARY, "War Boar", campaign=self.campaign)
        self.far = Warband.objects.create(campaign=self.elsewhere, user=self.outsider, name="Far", faction="Skaven")

    def edit(self, kind: Any, entry_id: int, body: dict[str, Any], user: Any = None) -> Any:
        return self.patch_as(user or self.player, kind.detail_url(entry_id), {"campaign_id": self.campaign.id, **body})

    def revert(self, kind: Any, entry_id: int, user: Any = None) -> Any:
        return self.post_as(user or self.player, f"{kind.detail_url(entry_id)}revert/")

    def hold_sword(self) -> None:
        """Every kind of copy of the book Sword in this campaign, and one in another campaign's stash."""
        self.hero.hero_items.create(item=self.book_sword, cost=7)
        self.group.henchmen_group_items.create(item=self.book_sword, cost=10)
        self.sword_unit.hireling_items.create(item=self.book_sword, cost=12)
        WarbandItem.objects.create(warband=self.warband, item=self.book_sword, quantity=2, cost=10)
        BestiaryEntryItem.objects.create(bestiary_entry=self.beast, item=self.book_sword, quantity=2)
        WarbandItem.objects.create(warband=self.far, item=self.book_sword, quantity=1, cost=10)

    def sword_copies(self) -> list[tuple[str, int, int | None]]:
        """(where, item id, stored cost or quantity) of every copy, sorted."""
        rows = [
            ("hero", *self.hero.hero_items.values_list("item_id", "cost").get()),
            ("henchmen", *self.group.henchmen_group_items.values_list("item_id", "cost").get()),
            ("hired sword", *self.sword_unit.hireling_items.values_list("item_id", "cost").get()),
            (
                "bestiary",
                *BestiaryEntryItem.objects.filter(bestiary_entry=self.beast).values_list("item_id", "quantity").get(),
            ),  # fmt: skip
            ("far stash", *WarbandItem.objects.filter(warband=self.far).values_list("item_id", "quantity").get()),
        ]
        rows += [("stash", item_id, cost) for item_id, cost in WarbandItem.objects.filter(warband=self.warband).values_list("item_id", "cost")]  # fmt: skip
        return sorted(rows)


class FirstEditTests(VersionTestCase):
    def test_a_first_edit_makes_one_version_and_moves_every_copy_with_its_cost(self):
        self.hold_sword()

        response = self.edit(ITEMS, self.book_sword.id, {"availabilities": [{"cost": 15}]})

        self.assertEqual(response.status_code, 200, response.data)
        version = Item.objects.get(campaign=self.campaign, replaces=self.book_sword)
        self.assertEqual(response.data["id"], version.id)
        self.assertEqual([row["cost"] for row in response.data["availabilities"]], [15])
        self.assertEqual([row["name"] for row in response.data["properties"]], ["Parry"])  # copied from the book
        self.assertEqual(
            self.sword_copies(),
            sorted(
                [
                    ("hero", version.id, 7),
                    ("henchmen", version.id, 10),
                    ("hired sword", version.id, 12),
                    ("bestiary", version.id, 2),
                    ("stash", version.id, 10),
                    ("far stash", self.book_sword.id, 1),  # another campaign's copy stays on the book
                ]
            ),
        )
        self.book_sword.refresh_from_db()
        self.assertEqual((self.book_sword.name, list(self.book_sword.availabilities.values_list("cost", flat=True))), ("Sword", [10]))  # fmt: skip

    def test_the_version_copies_the_book_entrys_children(self):
        response = self.edit(ITEMS, self.book_sword.id, {"name": "Sword"})

        version = Item.objects.get(id=response.data["id"])
        [availability] = version.availabilities.all()
        self.assertEqual((availability.cost, availability.rarity), (10, 2))
        self.assertEqual(list(availability.restriction_links.values_list("restriction_id", flat=True)), [self.mercenaries.id])  # fmt: skip
        self.assertEqual(list(version.property_links.values_list("property_id", flat=True)), [self.parry.id])
        self.assertEqual((version.campaign_id, version.campaign_type_id, version.archived_at), (self.campaign.id, None, None))  # fmt: skip
        self.assertEqual(self.book_sword.availabilities.get().restriction_links.count(), 1)  # the book keeps its own

    def test_later_edits_change_the_version_in_place_whichever_id_they_name(self):
        first = self.edit(ITEMS, self.book_sword.id, {"description": "Sharp"})
        by_book_id = self.edit(ITEMS, self.book_sword.id, {"description": "Sharper"})  # a list read before the edit
        by_version_id = self.patch_as(self.rival, ITEMS.detail_url(first.data["id"]), {"description": "Sharpest"})

        self.assertEqual({first.data["id"], by_book_id.data["id"], by_version_id.data["id"]}, {first.data["id"]})
        self.assertEqual(Item.objects.filter(replaces=self.book_sword).count(), 1)
        self.assertEqual(Item.objects.get(id=first.data["id"]).description, "Sharpest")

    def test_every_kind_moves_its_copies_onto_the_version(self):
        skill = self.infiltration[0]
        self.hero.hero_skills.create(skill=skill)
        self.group.henchmen_group_skills.create(skill=skill)
        BestiaryEntrySkill.objects.create(bestiary_entry=self.beast, skill=skill)
        self.hero.race = self.human
        self.hero.save(update_fields=["race"])
        WarbandBestiaryFavourite.objects.create(warband=self.warband, bestiary_entry=self.warhound)

        skill_version = self.edit(SKILLS, skill.id, {"description": "Hides."}).data["id"]
        race_version = self.edit(RACES, self.human.id, {"movement": 5}).data["id"]
        beast_version = self.edit(BESTIARY, self.warhound.id, {"description": "Hungry."}).data["id"]

        self.assertEqual(list(self.hero.hero_skills.values_list("skill_id", flat=True)), [skill_version])
        self.assertEqual(list(self.group.henchmen_group_skills.values_list("skill_id", flat=True)), [skill_version])
        self.assertEqual(list(BestiaryEntrySkill.objects.filter(bestiary_entry=self.beast).values_list("skill_id", flat=True)), [skill_version])  # fmt: skip
        self.hero.refresh_from_db()
        self.assertEqual(self.hero.race_id, race_version)
        self.assertEqual(list(WarbandBestiaryFavourite.objects.filter(warband=self.warband).values_list("bestiary_entry_id", flat=True)), [beast_version])  # fmt: skip
        self.assertEqual(Skill.objects.filter(name="Infiltration", campaign__isnull=True).count(), 6)

    def test_a_hired_swords_version_is_a_copied_entry_with_a_copied_profile(self):
        response = self.edit(HIRED_SWORDS, self.ogre.id, {"hire_cost": 95})

        self.assertEqual(response.status_code, 200, response.data)
        entry = BestiaryEntry.objects.get(campaign=self.campaign, replaces=self.ogre.bestiary_entry)
        self.assertEqual((response.data["id"], response.data["hire_cost"]), (entry.hired_sword_profile.id, 95))
        self.assertEqual(entry.hired_sword_profile.campaign_id, self.campaign.id)
        self.ogre.refresh_from_db()
        self.assertEqual(self.ogre.hire_cost, 80)


class RevertTests(VersionTestCase):
    def test_revert_moves_every_copy_back_with_its_cost_and_deletes_the_version(self):
        self.hold_sword()
        version_id = self.edit(ITEMS, self.book_sword.id, {"availabilities": [{"cost": 15}]}).data["id"]
        WarbandItem.objects.create(warband=self.warband, item=self.book_sword, quantity=3, cost=10)  # bought since

        response = self.revert(ITEMS, version_id)

        self.assertEqual((response.status_code, response.data["id"]), (200, self.book_sword.id))
        self.assertFalse(Item.objects.filter(id=version_id).exists())
        book = self.book_sword.id
        self.assertEqual(
            self.sword_copies(),
            sorted(
                [
                    ("hero", book, 7),
                    ("henchmen", book, 10),
                    ("hired sword", book, 12),
                    ("bestiary", book, 2),
                    ("stash", book, 10),  # the version's 2 copies joined the 3 at the same cost: one row
                    ("far stash", book, 1),
                ]
            ),
        )
        self.assertEqual(WarbandItem.objects.get(warband=self.warband).quantity, 5)
        self.assertTrue(RevertedVersion.objects.filter(kind="items", version_id=version_id, book_id=book).exists())

    def test_a_book_id_reverts_the_campaigns_version_of_it_and_anything_else_is_refused(self):
        version_id = self.edit(SKILLS, self.infiltration[0].id, {"description": "Hides."}).data["id"]
        custom = make_entry(SKILLS, "Ambush", campaign=self.campaign)

        by_book_id = self.post_as(self.player, f"{SKILLS.detail_url(self.infiltration[0].id)}revert/", {"campaign_id": self.campaign.id})  # fmt: skip
        again = self.post_as(self.player, f"{SKILLS.detail_url(self.infiltration[0].id)}revert/", {"campaign_id": self.campaign.id})  # fmt: skip
        not_one = self.revert(SKILLS, custom.id)

        self.assertEqual((by_book_id.status_code, by_book_id.data["id"]), (200, self.infiltration[0].id))
        self.assertFalse(Skill.objects.filter(id=version_id).exists())
        self.assertEqual((again.status_code, again.json()["code"]), (409, "not_a_version"))
        self.assertEqual((not_one.status_code, not_one.json()["code"]), (409, "not_a_version"))

    def test_a_hired_swords_revert_takes_its_copied_entry_and_profile(self):
        version = self.edit(HIRED_SWORDS, self.ogre.id, {"hire_cost": 95}).data["id"]

        response = self.revert(HIRED_SWORDS, version)

        self.assertEqual(
            (response.status_code, response.data["id"], response.data["hire_cost"]), (200, self.ogre.id, 80)
        )
        self.assertFalse(BestiaryEntry.objects.filter(campaign=self.campaign, replaces__isnull=False).exists())


class VersionBudgetTests(VersionTestCase):
    """CAT-TEST-23: a first edit and a Revert cost the same whatever the number of copies."""

    def count(self, call: Any) -> int:
        with CaptureQueriesContext(connection) as captured:
            response = call()
        self.assertEqual(response.status_code, 200, getattr(response, "data", None))
        return len(captured)

    def copies(self, item: Item, count: int) -> None:
        for index in range(count):
            make_unit(HERO, self.warband, name=f"Hero {item.id} {index}").hero_items.create(item=item, cost=index)
            self.group.henchmen_group_items.create(item=item, cost=index)
            self.sword_unit.hireling_items.create(item=item, cost=index)
            WarbandItem.objects.create(warband=self.warband, item=item, quantity=1, cost=index)
            BestiaryEntryItem.objects.create(bestiary_entry=make_entry(BESTIARY, f"Beast {item.id} {index}", campaign=self.campaign), item=item)  # fmt: skip

    def edit_and_revert(self, item: Item) -> tuple[int, int]:
        version: dict[str, int] = {}

        def edit() -> Any:
            response = self.edit(ITEMS, item.id, {"availabilities": [{"cost": 1}]})
            version["id"] = response.data["id"]
            return response

        return self.count(edit), self.count(lambda: self.revert(ITEMS, version["id"]))

    def test_a_first_edit_and_a_revert_are_constant_in_copies(self):
        few, many = make_entry(ITEMS, "Club"), make_entry(ITEMS, "Mace")
        self.copies(few, 1)
        self.copies(many, 6)

        self.assertEqual(self.edit_and_revert(many), self.edit_and_revert(few))
