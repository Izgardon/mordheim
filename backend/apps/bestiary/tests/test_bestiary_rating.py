"""A beast's own rating (William, 7 Nov 2026: "bestiary creatures need rating ... Just add field for now, will become
clear when seeding"): an optional whole number on every bestiary entry, read in the list, the detail and every write's
answer, set and cleared by a write, and carried by a campaign's version of a book beast like its other fields."""

from typing import Any

from apps.bestiary.models import BestiaryEntry
from apps.items.tests.catalogue_support import BESTIARY, CatalogueTestCase, make_entry


class BestiaryRatingTests(CatalogueTestCase):
    def create(self, name: str, **body: Any) -> Any:
        return self.create_as(self.owner, BESTIARY, name, **body)

    def test_an_entry_has_no_rating_unless_given_one(self):
        self.assertIsNone(make_entry(BESTIARY, "Ymir").rating)

    def test_a_create_and_an_edit_set_and_clear_it(self):
        created = self.create("Dragon Ogre", kind="creature", rating=40)
        beast_id = created.data["id"]
        changed = self.patch_as(self.owner, BESTIARY.detail_url(beast_id), {"rating": 55})
        unrelated = self.patch_as(self.owner, BESTIARY.detail_url(beast_id), {"description": "Big."})
        cleared = self.patch_as(self.owner, BESTIARY.detail_url(beast_id), {"rating": None})

        self.assertEqual((created.status_code, created.data["rating"]), (201, 40), created.data)
        self.assertEqual((changed.status_code, changed.data["rating"]), (200, 55))
        self.assertEqual(unrelated.data["rating"], 55)
        self.assertEqual(cleared.data["rating"], None)
        self.assertIsNone(BestiaryEntry.objects.get(pk=beast_id).rating)

    def test_it_is_a_whole_number_from_zero(self):
        negative = self.create("Hydra", kind="creature", rating=-1)
        fraction = self.create("Giant", kind="creature", rating=2.5)
        words = self.create("Orc", kind="creature", rating="lots")
        zero = self.create("Goblin", kind="creature", rating=0)

        for refused in (negative, fraction, words):
            self.assertEqual((refused.status_code, list(refused.data)), (400, ["rating"]))
        self.assertEqual((zero.status_code, zero.data["rating"]), (201, 0))

    def test_the_list_and_the_detail_read_it(self):
        BestiaryEntry.objects.filter(pk=self.warhound.pk).update(rating=25)

        rows = self.get_as(self.player, BESTIARY.list_url(self.campaign)).json()
        brief = self.get_as(self.player, f"{BESTIARY.list_url(self.campaign)}&view=summary").json()
        detail = self.get_as(self.player, BESTIARY.detail_url(self.warhound.id))

        self.assertEqual([(row["name"], row["rating"]) for row in rows], [("Warhound", 25)])
        self.assertEqual(brief[0]["rating"], 25)
        self.assertEqual(detail.data["rating"], 25)

    def test_a_campaigns_version_keeps_the_books_rating_and_says_when_it_changed_it(self):
        BestiaryEntry.objects.filter(pk=self.warhound.pk).update(rating=25)
        url = BESTIARY.detail_url(self.warhound.id)

        version = self.patch_as(self.owner, url, {"campaign_id": self.campaign.id, "description": "Loyal."})
        rated = self.patch_as(self.owner, BESTIARY.detail_url(version.data["id"]), {"rating": 30})

        self.assertEqual(version.status_code, 200, version.data)
        self.assertEqual((version.data["replaces"], version.data["rating"]), (self.warhound.id, 25))
        self.assertNotIn("rating", version.data["book"]["changes"])
        self.assertEqual((rated.data["rating"], rated.data["book"]["changes"]["rating"]), (30, 25))
        self.assertEqual(BestiaryEntry.objects.get(pk=self.warhound.pk).rating, 25)
