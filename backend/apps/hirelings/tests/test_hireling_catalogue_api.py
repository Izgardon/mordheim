"""The hireling catalogue's payloads: `GET /api/hired-swords/` and `/api/dramatis-personae/` (the bestiary rewrite
step 2).

A list row is the entry with its race (the catalogue's and the source's text) and restrictions; a detail adds its
skills, specials, spells and equipment with quantities. A dramatis persona adds `stays` and `payment_note`. Every
row ends with the catalogue's badge fields. Both kinds cost the same queries whatever the number of rows or the
kit's size.
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.core.catalogue.payloads import BADGES
from apps.items.tests.catalogue_support import DRAMATIS_PERSONAE, HIRED_SWORDS, ITEMS, CatalogueTestCase, make_entry

STATS = [
    "movement",
    "weapon_skill",
    "ballistic_skill",
    "strength",
    "toughness",
    "wounds",
    "initiative",
    "attacks",
    "leadership",
]
ROW = [
    "id",
    "campaign_id",
    "campaign_type_id",
    "name",
    "description",
    *STATS,
    "armour_save",
    "large",
    "caster",
    "race_id",
    "race_name",
    "race_label",
    "hire_cost",
    "hire_cost_expression",
    "upkeep_cost",
    "upkeep_cost_expression",
    "rating",
    "available_skill_types",
    "grade",
]
KIT = ["skills", "specials", "spells", "equipment"]


class HirelingPayloadTests(CatalogueTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.ogre.restriction_links.create(restriction=self.mercenaries, additional_note="only")
        self.ogre.skill_links.create(skill=self.infiltration[0])
        self.ogre.special_links.create(special=self.large)
        self.ogre.spell_links.create(spell=self.lifestealer[0])
        self.ogre.item_links.create(item=self.book_sword, quantity=2)
        self.aenur.item_links.create(item=self.book_axe)
        self.ogre.race = self.human
        self.ogre.race_label = "Ogre"
        self.ogre.save(update_fields=["race", "race_label"])

    def get(self, url: str) -> Any:
        response = self.get_as(self.player, url)
        self.assertEqual(response.status_code, 200, response.data)
        return response.json()

    def test_a_hired_sword_row_and_detail(self):
        [row] = [row for row in self.get(HIRED_SWORDS.list_url(self.campaign)) if row["id"] == self.ogre.id]
        detail = self.get(HIRED_SWORDS.detail_url(self.ogre.id))

        self.assertEqual(list(row), [*ROW, "restrictions", *BADGES])
        self.assertEqual(list(detail), [*ROW, "restrictions", *KIT, *BADGES])
        self.assertEqual((row["race_id"], row["race_name"], row["race_label"]), (self.human.id, "Human", "Ogre"))
        restriction = {"id": self.mercenaries.id, "type": "Warband", "restriction": "Mercenaries"}
        self.assertEqual(row["restrictions"], [{"restriction": restriction, "additional_note": "only"}])
        self.assertEqual([entry["name"] for entry in detail["skills"]], ["Infiltration"])
        self.assertEqual(([entry["name"] for entry in detail["specials"]], [entry["name"] for entry in detail["spells"]]), (["Large"], ["Lifestealer"]))  # fmt: skip
        self.assertEqual([(entry["item"]["name"], entry["quantity"]) for entry in detail["equipment"]], [("Sword", 2)])

    def test_a_dramatis_persona_says_how_long_it_stays_and_what_it_is_paid(self):
        created = self.create_as(self.player, DRAMATIS_PERSONAE, "Bertha", stays="one_battle", payment_note="a favour")
        [row] = [row for row in self.get(DRAMATIS_PERSONAE.list_url(self.campaign)) if row["name"] == "Bertha"]

        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(list(created.data), [*ROW, "stays", "payment_note", "restrictions", *KIT, *BADGES])
        self.assertEqual(list(row), [*ROW, "stays", "payment_note", "restrictions", *BADGES])
        self.assertEqual((row["stays"], row["payment_note"], row["campaign_id"]), ("one_battle", "a favour", self.campaign.id))  # fmt: skip

    def test_a_hired_sword_is_not_a_bestiary_entry(self):
        bestiary = [row["name"] for row in self.get(f"/api/bestiary/?campaign_id={self.campaign.id}")]

        self.assertNotIn("Ogre Bodyguard", bestiary)

    def test_both_lists_and_details_cost_the_same_whatever_the_rows_and_kits(self):
        def counts() -> list[int]:
            found = []
            for url in (
                HIRED_SWORDS.list_url(self.campaign),
                DRAMATIS_PERSONAE.list_url(self.campaign),
                HIRED_SWORDS.detail_url(self.ogre.id),
                DRAMATIS_PERSONAE.detail_url(self.aenur.id),
            ):
                with CaptureQueriesContext(connection) as captured:
                    self.get(url)
                found.append(len(captured))
            return found

        before = counts()
        for index in range(3):
            for kind in (HIRED_SWORDS, DRAMATIS_PERSONAE):
                make_entry(kind, f"More {index}", campaign=self.campaign).restriction_links.create(restriction=self.mercenaries)  # fmt: skip
            item = make_entry(ITEMS, f"Gear {index}")
            self.ogre.item_links.create(item=item)
            self.aenur.item_links.create(item=item)
            self.aenur.skill_links.create(skill=self.infiltration[index + 1])

        self.assertEqual(counts(), before)
        self.assertEqual(before, [3, 3, 9, 9])  # membership, rows, restrictions; a book detail reads no membership
