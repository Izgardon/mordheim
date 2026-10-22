"""Deleting an entry in use archives it; a book entry is deleted for one campaign (pass 5 PR C; decision 5,
CAT-TWEAK-04, CAT-NEW-05, CAT-TEST-25).

DELETE of a custom entry deletes it when nothing holds it (204) and archives it when something does (200,
`{"outcome": "archived", "usage"}`). DELETE of a book entry with the campaign's id removes it from that campaign
alone (200, `{"outcome": "removed", "usage"}`). A version is refused (409 `use_revert`). Lists leave archived and
removed entries out unless `?archived=1`; `POST restore/` brings them back; `GET usage/` counts the campaign's
copies. Archived ids stay valid in unit writes, and buying one from a stale list warns `archived_entry`.
"""

from typing import Any

from django.utils import timezone

from apps.bestiary.models import BestiaryEntry
from apps.core.models import CatalogueRemoval
from apps.skills.models import Skill
from apps.warbands.models import Warband, WarbandItem
from apps.warbands.tests.roster_support import HERO, make_unit, unit_url

from .catalogue_support import BESTIARY, HIRED_SWORDS, ITEMS, SKILLS, CatalogueTestCase, make_entry

NO_USE = {"units": 0, "warbands": 0, "stashes": 0, "bestiary_entries": 0, "hired_swords": 0, "dramatis_personae": 0}


class ArchiveTestCase(CatalogueTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.hero = make_unit(HERO, self.warband, name="Abbess")

    def ids(self, kind: Any, query: str = "", campaign: Any = None) -> list[int]:
        response = self.get_as(self.player, f"{kind.list_url(campaign or self.campaign)}{query}")
        self.assertEqual(response.status_code, 200)
        return [row["id"] for row in response.json()]

    def book_delete(self, kind: Any, entry_id: int, user: Any = None) -> Any:
        return self.delete_as(user or self.owner, f"{kind.detail_url(entry_id)}?campaign_id={self.campaign.id}")


class CustomArchiveTests(ArchiveTestCase):
    def test_an_entry_in_use_is_archived_hidden_and_restored(self):
        ambush = make_entry(SKILLS, "Ambush", campaign=self.campaign)
        self.hero.hero_skills.create(skill=ambush)

        archived = self.delete_as(self.owner, SKILLS.detail_url(ambush.id))
        hidden, shown = self.ids(SKILLS), self.ids(SKILLS, "&archived=1")
        restored = self.post_as(self.player, f"{SKILLS.detail_url(ambush.id)}restore/")

        self.assertEqual((archived.status_code, archived.json()), (200, {"outcome": "archived", "usage": {**NO_USE, "units": 1, "warbands": 1}}))  # fmt: skip
        self.assertEqual((ambush.id in hidden, ambush.id in shown), (False, True))
        self.assertEqual(restored.status_code, 200)
        self.assertIn(ambush.id, self.ids(SKILLS))
        self.assertIsNone(Skill.objects.get(id=ambush.id).archived_at)
        self.assertEqual(list(self.hero.hero_skills.values_list("skill_id", flat=True)), [ambush.id])

    def test_an_unused_entry_is_deleted(self):
        for kind in (ITEMS, SKILLS, BESTIARY, HIRED_SWORDS):  # nothing holds an entry of the bestiary: always deleted
            with self.subTest(kind=kind.key):
                entry = make_entry(kind, f"Spare {kind.key}", campaign=self.campaign)
                self.assertEqual(self.delete_as(self.owner, kind.detail_url(entry.id)).status_code, 204)
                self.assertFalse(kind.model._default_manager.filter(id=entry.id).exists())

    def test_a_version_is_reverted_not_deleted(self):
        version = self.patch_as(self.player, SKILLS.detail_url(self.infiltration[0].id), {"campaign_id": self.campaign.id, "description": "Hides."})  # fmt: skip

        refused = self.delete_as(self.owner, SKILLS.detail_url(version.data["id"]))
        by_book_id = self.book_delete(SKILLS, self.infiltration[0].id)  # a list read before the edit

        self.assertEqual((refused.status_code, refused.json()["code"]), (409, "use_revert"))
        self.assertEqual((by_book_id.status_code, by_book_id.json()["code"]), (409, "use_revert"))
        self.assertTrue(Skill.objects.filter(id=version.data["id"]).exists())
        self.assertFalse(CatalogueRemoval.objects.exists())

    def test_archived_ids_stay_valid_in_a_full_list_patch_and_buying_one_warns(self):
        ambush = make_entry(SKILLS, "Ambush", campaign=self.campaign, archived_at=timezone.now())
        charm = make_entry(ITEMS, "Charm", campaign=self.campaign, cost=6, archived_at=timezone.now())
        url = unit_url(HERO, self.warband.id, self.hero.id)

        patched = self.patch_as(self.player, url, {"skill_ids": [ambush.id], "items": [{"id": charm.id, "cost": 6}]})
        bought = self.post_as(self.player, f"/api/warbands/{self.warband.id}/purchases/", {"item_id": charm.id, "target_type": "stash"})  # fmt: skip

        self.assertEqual(patched.status_code, 200, patched.data)
        self.assertEqual(list(self.hero.hero_skills.values_list("skill_id", flat=True)), [ambush.id])
        self.assertEqual(bought.status_code, 201, bought.data)
        self.assertEqual([(warning["code"], warning["item_id"]) for warning in bought.json()["warnings"]], [("archived_entry", charm.id)])  # fmt: skip


class BookRemovalTests(ArchiveTestCase):
    def test_a_book_entry_is_removed_for_this_campaign_alone_and_restored(self):
        WarbandItem.objects.create(warband=self.warband, item=self.book_axe, quantity=2, cost=5)
        far = Warband.objects.create(campaign=self.elsewhere, user=self.outsider, name="Far", faction="Skaven")
        WarbandItem.objects.create(warband=far, item=self.book_axe, quantity=1, cost=5)

        removed = self.book_delete(ITEMS, self.book_axe.id)

        self.assertEqual((removed.status_code, removed.json()), (200, {"outcome": "removed", "usage": {**NO_USE, "warbands": 1, "stashes": 1}}))  # fmt: skip
        self.assertNotIn(self.book_axe.id, self.ids(ITEMS))
        self.assertIn(self.book_axe.id, self.ids(ITEMS, "&archived=1"))
        self.assertIn(self.book_axe.id, [row["id"] for row in self.get_as(self.outsider, ITEMS.list_url(self.elsewhere)).json()])  # fmt: skip
        self.assertIn(self.book_axe.id, [row["id"] for row in self.get_as(self.player, ITEMS.list_url()).json()])
        self.assertEqual(WarbandItem.objects.filter(item=self.book_axe).count(), 2)  # copies stay
        bought = self.post_as(self.player, f"/api/warbands/{self.warband.id}/purchases/", {"item_id": self.book_axe.id, "target_type": "stash"})  # fmt: skip
        self.assertEqual([warning["code"] for warning in bought.json()["warnings"]], ["archived_entry"])
        restored = self.post_as(self.player, f"{ITEMS.detail_url(self.book_axe.id)}restore/", {"campaign_id": self.campaign.id})  # fmt: skip
        self.assertEqual((restored.status_code, restored.json()["id"]), (200, self.book_axe.id))
        self.assertIn(self.book_axe.id, self.ids(ITEMS))
        self.assertFalse(CatalogueRemoval.objects.exists())

    def test_a_hired_sword_removed_leaves_both_of_this_campaigns_lists(self):
        response = self.book_delete(HIRED_SWORDS, self.ogre.id)

        self.assertEqual(response.json()["outcome"], "removed")
        self.assertNotIn(self.ogre.id, self.ids(HIRED_SWORDS))
        self.assertNotIn(self.ogre.bestiary_entry_id, self.ids(BESTIARY))
        self.assertTrue(BestiaryEntry.objects.filter(id=self.ogre.bestiary_entry_id).exists())

    def test_removing_a_book_entry_needs_delete_catalogue(self):
        self.assertEqual(self.book_delete(SKILLS, self.infiltration[0].id, user=self.player).status_code, 403)
        self.grant(self.player, "delete_catalogue")
        self.assertEqual(self.book_delete(SKILLS, self.infiltration[0].id, user=self.player).status_code, 200)


class UsageTests(ArchiveTestCase):
    def test_usage_counts_the_campaigns_copies_in_the_delete_answers_shape(self):
        far = Warband.objects.create(campaign=self.elsewhere, user=self.outsider, name="Far", faction="Skaven")
        self.hero.hero_items.create(item=self.book_sword, cost=10)
        WarbandItem.objects.create(warband=far, item=self.book_sword, quantity=1, cost=10)  # another campaign's
        charm = make_entry(ITEMS, "Charm", campaign=self.campaign)

        book = self.get_as(self.player, f"{ITEMS.detail_url(self.book_sword.id)}usage/?campaign_id={self.campaign.id}")
        custom = self.get_as(self.player, f"{ITEMS.detail_url(charm.id)}usage/")
        outsider = self.get_as(self.outsider, f"{ITEMS.detail_url(charm.id)}usage/")

        self.assertEqual((book.status_code, book.json()), (200, {**NO_USE, "units": 1, "warbands": 1}))
        self.assertEqual((custom.status_code, custom.json()), (200, NO_USE))
        self.assertEqual(outsider.status_code, 404)
