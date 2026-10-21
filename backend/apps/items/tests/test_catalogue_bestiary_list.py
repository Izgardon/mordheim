"""The bestiary list's additive query parameters for the Bestiary page and pickers (PERF-47).

`?exclude_type=` leaves out entries of a type (any case, repeatable) after today's name rule, as the page's own
filter did, so it can stop fetching the 72 hired swords it drops. `?view=summary` sends each row without its
description. Without them, the list is unchanged.
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from .catalogue_support import BESTIARY, CatalogueTestCase, make_entry

DEFAULT_KEYS = [
    "id",
    "campaign_id",
    "name",
    "type",
    "description",
    "movement",
    "weapon_skill",
    "ballistic_skill",
    "strength",
    "toughness",
    "wounds",
    "initiative",
    "attacks",
    "leadership",
    "armour_save",
    "large",
    "caster",
]


class BestiaryListViewsTests(CatalogueTestCase):
    """The book's Warhound (Animal) and the Ogre Bodyguard (a hired sword's "Hired Sword" entry), plus a campaign
    monster."""

    def setUp(self) -> None:
        super().setUp()
        make_entry(BESTIARY, "Rat Ogre", campaign=self.campaign, type="Monster", description="Big.")

    def rows(self, query: str = "") -> list[dict[str, Any]]:
        response = self.get_as(self.player, f"{BESTIARY.list_url(self.campaign)}{query}")
        self.assertEqual(response.status_code, 200)
        rows: list[dict[str, Any]] = response.json()
        return rows

    def test_the_default_list_is_unchanged(self):
        rows = self.rows("&view=full")

        self.assertEqual([(row["name"], row["type"]) for row in rows], [("Rat Ogre", "Monster"), ("Ogre Bodyguard", "Hired Sword"), ("Warhound", "Animal")])  # fmt: skip
        self.assertEqual([list(row) for row in rows], [DEFAULT_KEYS] * 3)
        self.assertEqual(rows, self.rows())

    def test_exclude_type_leaves_out_a_type_in_any_case_and_repeats(self):
        self.assertEqual([row["name"] for row in self.rows("&exclude_type=hired sword")], ["Rat Ogre", "Warhound"])
        self.assertEqual([row["name"] for row in self.rows("&exclude_type=Hired Sword&exclude_type=Monster")], ["Warhound"])  # fmt: skip
        self.assertEqual(len(self.rows("&exclude_type=")), 3)

    def test_exclude_type_applies_after_the_name_rule_as_the_page_did(self):
        # BUG-18's rule (PR C): the campaign's hired sword "Warhound" hides the book's Warhound; leaving out hired
        # swords then shows neither, as the page's filter did
        make_entry(BESTIARY, "Warhound", campaign=self.campaign, type="Hired Sword")

        self.assertNotIn("Warhound", [row["name"] for row in self.rows("&exclude_type=Hired Sword")])

    def test_the_summary_view_drops_the_description_and_keeps_the_rest_in_order(self):
        rows = self.rows("&view=summary&exclude_type=Hired Sword")

        self.assertEqual([row["name"] for row in rows], ["Rat Ogre", "Warhound"])
        self.assertEqual([list(row) for row in rows], [[key for key in DEFAULT_KEYS if key != "description"]] * 2)

    def test_the_views_cost_what_the_default_list_costs(self):
        def count(query: str) -> int:
            with CaptureQueriesContext(connection) as captured:
                self.rows(query)
            return len(captured)

        self.assertEqual(count("&view=summary&exclude_type=Hired Sword"), count(""))
