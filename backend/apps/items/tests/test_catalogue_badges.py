"""What the "Custom" and "House rule" badges read (pass 5 PR C; optional d, CAT-NEW-03).

Every catalogue row and detail carries `replaces` (the book entry a version stands in for), `archived_at`,
`updated_by` (a display name), `updated_at` and, for a version, `book`: the book entry's id and name, the fields the
version changed with the book's values, and an item's book price. A house rule's clone also says its rule
(`generated_effect_key`).
"""

from typing import Any

from django.utils import timezone

from apps.core.catalogue.payloads import BADGES
from apps.items.services import HALF_PRICE_ARMOUR_EFFECT_KEY

from .catalogue_support import HIRED_SWORDS, ITEMS, KINDS, RACES, SKILLS, CatalogueTestCase, make_entry

EMPTY = {"replaces": None, "archived_at": None, "updated_by": None, "updated_at": None, "book": None}


def badges(row: dict[str, Any]) -> dict[str, Any]:
    return {key: row[key] for key in BADGES}


class BadgeTests(CatalogueTestCase):
    def row(self, kind: Any, entry_id: int, query: str = "") -> dict[str, Any]:
        rows = self.get_as(self.player, f"{kind.list_url(self.campaign)}{query}").json()
        return next(row for row in rows if row["id"] == entry_id)

    def test_every_kind_lists_and_details_the_badges_after_its_own_keys(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                house = make_entry(kind, f"House {kind.key}", campaign=self.campaign)
                listed = self.row(kind, house.id)
                self.assertEqual(list(listed)[-len(BADGES) :], list(BADGES))
                self.assertEqual(badges(listed), EMPTY)  # written directly: nobody wrote it through the catalogue
                if kind is not RACES:  # races have no detail read
                    self.assertEqual(list(self.get_as(self.player, kind.detail_url(house.id)).json())[-len(BADGES) :], list(BADGES))  # fmt: skip

    def test_a_custom_entry_says_who_wrote_it_and_when(self):
        created = self.create_as(self.player, SKILLS, "Ambush")
        edited = self.patch_as(self.rival, SKILLS.detail_url(created.data["id"]), {"description": "Strikes first."})

        self.assertEqual((created.data["updated_by"], created.data["replaces"], created.data["book"]), ("Pia", None, None))  # fmt: skip
        self.assertEqual(edited.data["updated_by"], "Rex")
        self.assertGreaterEqual(edited.data["updated_at"], created.data["updated_at"])
        self.assertEqual(badges(self.row(SKILLS, created.data["id"]))["updated_by"], "Rex")

    def test_a_version_shows_its_book_entry_and_what_it_changed(self):
        body = {"campaign_id": self.campaign.id, "description": "A keen edge.", "availabilities": [{"cost": 15}]}
        version = self.patch_as(self.rival, ITEMS.detail_url(self.book_sword.id), body).data

        listed = badges(self.row(ITEMS, version["id"]))

        self.assertEqual((listed["replaces"], listed["updated_by"]), (self.book_sword.id, "Rex"))
        # the edit filled the weapon's empty strength and range with their defaults (BUG-151), so they changed too
        changes = {"description": "", "strength": None, "range": None}
        self.assertEqual(listed["book"], {"id": self.book_sword.id, "name": "Sword", "changes": changes, "price": 10})
        self.assertEqual(version["book"], listed["book"])

    def test_a_hired_swords_version_names_the_book_hired_sword_and_its_book_values(self):
        body = {"campaign_id": self.campaign.id, "hire_cost": 95, "name": "Ogre Mercenary"}
        version = self.patch_as(self.player, HIRED_SWORDS.detail_url(self.ogre.id), body).data

        listed = badges(self.row(HIRED_SWORDS, version["id"]))

        self.assertEqual((version["replaces"], listed["replaces"]), (self.ogre.id, self.ogre.id))
        self.assertEqual(listed["book"], {"id": self.ogre.id, "name": "Ogre Bodyguard", "changes": {"name": "Ogre Bodyguard", "hire_cost": 80}})  # fmt: skip

    def test_archived_and_removed_entries_say_since_when_in_the_archived_list(self):
        archived = make_entry(SKILLS, "Ambush", campaign=self.campaign, archived_at=timezone.now())
        self.delete_as(self.owner, f"{SKILLS.detail_url(self.infiltration[0].id)}?campaign_id={self.campaign.id}")

        archived_row = self.row(SKILLS, archived.id, "&archived=1")
        removed_row = self.row(SKILLS, self.infiltration[0].id, "&archived=1")
        kept_row = self.row(SKILLS, self.infiltration[1].id, "&archived=1")

        self.assertIsNotNone(archived_row["archived_at"])
        self.assertIsNotNone(removed_row["archived_at"])
        self.assertEqual(kept_row["archived_at"], None)

    def test_a_house_rule_clone_says_its_rule_and_its_book_price(self):
        self.post_as(
            self.owner, self.url("rules/"), {"title": "Half price", "effect_key": HALF_PRICE_ARMOUR_EFFECT_KEY}
        )
        rows = self.get_as(self.player, f"{ITEMS.list_url(self.campaign)}&type=armour").json()

        [clone] = rows
        self.assertEqual((clone["generated_effect_key"], clone["replaces"]), (HALF_PRICE_ARMOUR_EFFECT_KEY, self.heavy_armour.id))  # fmt: skip
        self.assertEqual((clone["book"]["price"], clone["book"]["changes"]), (50, {}))
