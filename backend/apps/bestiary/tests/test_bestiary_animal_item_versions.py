"""A beast's Animal item follows it through pass 5's versions, Revert, archive, removal and restore (the bestiary
rewrite step 3; the item is the bestiary's twin in the kinds registry).

A campaign's first edit of a book beast makes the campaign's version of its item too, pointing at the beast's
version, and moves the campaign's copies of the item (units' items, stashes, kits, bestiary equipment) onto it with
their stored costs. Revert takes both back. Deleting a beast takes its item along: deleted with it, archived with it
when something holds the item, removed with it for the campaign; Restore brings both back. A beast's usage is its
item's.
"""

from typing import Any

from apps.bestiary.models import BestiaryEntry, BestiaryEntryItem
from apps.core.models import CatalogueRemoval, RevertedVersion
from apps.hirelings.models import HiredSword
from apps.items.models import Item
from apps.items.tests.catalogue_support import BESTIARY, HIRED_SWORDS, ITEMS, CatalogueTestCase, make_beast, make_entry
from apps.warbands.models import WarbandItem
from apps.warbands.tests.roster_support import HERO, make_unit

NO_USE = {"units": 0, "warbands": 0, "stashes": 0, "bestiary_entries": 0, "hired_swords": 0, "dramatis_personae": 0}


class BeastTestCase(CatalogueTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.horse = make_beast("Warhorse", kind="mount", available_in_shop=True, cost=80)
        self.item = self.horse.animal_item
        self.hero = make_unit(HERO, self.warband, name="Aldric")

    def hold(self, item: Item) -> None:
        """The hero's copy, a stash row, a hired sword's kit and another beast's equipment hold `item`."""
        self.hero.hero_items.create(item=item, cost=80)
        WarbandItem.objects.create(warband=self.warband, item=item, quantity=1, cost=80)
        make_entry(HIRED_SWORDS, "Freelancer", campaign=self.campaign).item_links.create(item=item)
        BestiaryEntryItem.objects.create(bestiary_entry=make_entry(BESTIARY, "Knight", campaign=self.campaign), item=item)  # fmt: skip

    def holders(self) -> list[int]:
        """The item each copy made by `hold` points at."""
        return [
            self.hero.hero_items.get().item_id,
            WarbandItem.objects.get(warband=self.warband).item_id,
            HiredSword.objects.get(name="Freelancer").item_links.get().item_id,
            BestiaryEntryItem.objects.get(bestiary_entry__name="Knight").item_id,
        ]

    def edit(self, body: dict[str, Any]) -> Any:
        return self.patch_as(self.player, BESTIARY.detail_url(self.horse.id), {"campaign_id": self.campaign.id, **body})


class AnimalItemVersionTests(BeastTestCase):
    def test_a_first_edit_versions_the_beast_and_its_item_together(self):
        self.hold(self.item)

        response = self.edit({"name": "Charger", "item": {"availabilities": [{"cost": 90, "rarity": 11}]}})

        self.assertEqual(response.status_code, 200, response.data)
        version = BestiaryEntry.objects.get(campaign=self.campaign, replaces=self.horse)
        copy = Item.objects.get(campaign=self.campaign, replaces=self.item)
        self.assertEqual((copy.bestiary_entry_id, copy.name, copy.subtype, copy.listed), (version.id, "Charger", "Mount", True))  # fmt: skip
        self.assertEqual(list(copy.availabilities.values_list("cost", "rarity")), [(90, 11)])
        self.assertEqual(response.data["item"]["id"], copy.id)
        self.assertEqual(self.holders(), [copy.id] * 4)
        self.assertEqual(self.hero.hero_items.get().cost, 80)  # what was paid stays
        self.item.refresh_from_db()
        self.assertEqual((self.item.name, self.item.bestiary_entry_id), ("Warhorse", self.horse.id))
        self.assertEqual(list(self.item.availabilities.values_list("cost", flat=True)), [80])

    def test_later_edits_change_both_versions_in_place(self):
        first = self.edit({"description": "Proud."})
        second = self.edit({"available_in_shop": False})

        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(Item.objects.filter(replaces=self.item).count(), 1)
        self.assertEqual(Item.objects.get(replaces=self.item).listed, False)
        self.assertTrue(Item.objects.get(pk=self.item.pk).listed)  # the book still sells it

    def test_the_campaigns_items_list_shows_its_version_of_the_item(self):
        self.edit({"name": "Charger"})

        names = [row["name"] for row in self.get_as(self.player, f"{ITEMS.list_url(self.campaign)}&type=Animal").json()]
        theirs = [row["name"] for row in self.get_as(self.outsider, f"{ITEMS.list_url(self.elsewhere)}&type=Animal").json()]  # fmt: skip

        self.assertEqual((names, theirs), (["Charger"], ["Warhorse"]))

    def test_revert_takes_the_items_version_back_too(self):
        self.hold(self.item)
        version = self.edit({"name": "Charger"}).data
        copy_id = version["item"]["id"]

        response = self.post_as(self.player, f"{BESTIARY.detail_url(version['id'])}revert/")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual((response.data["id"], response.data["item"]["id"]), (self.horse.id, self.item.id))
        self.assertFalse(Item.objects.filter(pk=copy_id).exists())
        self.assertEqual(self.holders(), [self.item.id] * 4)
        self.assertEqual(self.hero.hero_items.get().cost, 80)
        self.assertTrue(
            RevertedVersion.objects.filter(
                campaign=self.campaign, kind="items", version_id=copy_id, book_id=self.item.id
            ).exists()  # fmt: skip
        )


class AnimalItemRepairTests(BeastTestCase):
    """A beast written before every beast had its item (or written directly) gets one when a campaign edits it, so its
    version always has the version of the book's item, and Revert can take it back."""

    def test_a_book_beast_without_an_item_gets_one_and_its_version_on_a_first_edit(self):
        version = self.patch_as(self.player, BESTIARY.detail_url(self.warhound.id), {"campaign_id": self.campaign.id, "name": "Hound"})  # fmt: skip

        self.assertEqual(version.status_code, 200, version.data)
        book = Item.objects.get(bestiary_entry=self.warhound)
        copy = Item.objects.get(id=version.data["item"]["id"])
        self.assertEqual(
            (book.campaign_id, book.name, copy.replaces_id, copy.name), (None, "Warhound", book.id, "Hound")
        )
        self.hero.hero_items.create(item=copy, cost=25)

        reverted = self.post_as(self.player, f"{BESTIARY.detail_url(version.data['id'])}revert/")

        self.assertEqual((reverted.status_code, reverted.data["item"]["id"]), (200, book.id))
        self.assertEqual(self.hero.hero_items.get().item_id, book.id)

    def test_a_version_without_an_item_gets_the_version_of_its_book_beasts_item(self):
        version = make_entry(BESTIARY, "Charger", campaign=self.campaign, kind="mount", replaces=self.horse)

        edited = self.patch_as(self.player, BESTIARY.detail_url(version.id), {"description": "Proud."})

        copy = Item.objects.get(bestiary_entry=version)
        self.assertEqual((edited.data["item"]["id"], copy.replaces_id, copy.campaign_id), (copy.id, self.item.id, self.campaign.id))  # fmt: skip


class AnimalItemArchiveTests(BeastTestCase):
    def delete(self, beast: BestiaryEntry) -> Any:
        return self.delete_as(self.owner, f"{BESTIARY.detail_url(beast.id)}?campaign_id={self.campaign.id}")

    def restore(self, beast: BestiaryEntry) -> Any:
        return self.post_as(self.owner, f"{BESTIARY.detail_url(beast.id)}restore/", {"campaign_id": self.campaign.id})

    def animals(self) -> list[str]:
        return [row["name"] for row in self.get_as(self.player, f"{ITEMS.list_url(self.campaign)}&type=Animal").json()]

    def test_deleting_a_beast_nothing_holds_deletes_its_item(self):
        mule = make_beast("Mule", campaign=self.campaign, kind="mount", cost=30)

        self.assertEqual(self.delete(mule).status_code, 204)

        self.assertFalse(Item.objects.filter(name="Mule").exists())

    def test_a_beast_whose_item_is_held_is_archived_with_it_and_answers_the_items_usage(self):
        mule = make_beast("Mule", campaign=self.campaign, kind="mount", cost=30)
        self.hero.hero_items.create(item=mule.animal_item, cost=30)

        deleted = self.delete(mule)

        self.assertEqual(deleted.status_code, 200, deleted.data)
        self.assertEqual(deleted.json(), {"outcome": "archived", "usage": {**NO_USE, "units": 1, "warbands": 1}})
        self.assertIsNotNone(Item.objects.get(name="Mule").archived_at)
        self.assertNotIn("Mule", self.animals())
        self.assertEqual(self.restore(mule).status_code, 200)
        self.assertEqual((BestiaryEntry.objects.get(pk=mule.pk).archived_at, Item.objects.get(name="Mule").archived_at), (None, None))  # fmt: skip
        self.assertIn("Mule", self.animals())

    def test_removing_a_book_beast_removes_its_item_for_the_campaign_alone(self):
        removed = self.delete(self.horse)

        self.assertEqual((removed.status_code, removed.json()["outcome"]), (200, "removed"))
        self.assertTrue(CatalogueRemoval.objects.filter(campaign=self.campaign, kind="items", entry_id=self.item.id).exists())  # fmt: skip
        self.assertNotIn("Warhorse", self.animals())
        self.assertIn("Warhorse", [row["name"] for row in self.get_as(self.outsider, f"{ITEMS.list_url(self.elsewhere)}&type=Animal").json()])  # fmt: skip
        self.assertEqual(self.restore(self.horse).status_code, 200)
        self.assertFalse(CatalogueRemoval.objects.filter(campaign=self.campaign).exists())
        self.assertIn("Warhorse", self.animals())

    def test_a_beasts_usage_is_its_items(self):
        self.hold(self.item)

        usage = self.get_as(self.player, f"{BESTIARY.detail_url(self.horse.id)}usage/?campaign_id={self.campaign.id}")

        self.assertEqual(usage.json(), {**NO_USE, "units": 1, "warbands": 1, "stashes": 1, "bestiary_entries": 1, "hired_swords": 1})  # fmt: skip
