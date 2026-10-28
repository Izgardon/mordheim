"""The bestiary list's additive query parameters for the Bestiary page and pickers (PERF-47).

`?kind=` keeps entries of one kind or several (mount, pet, creature) before the list rule (merge.py); the bestiary
rewrite step 3 replaced `?exclude_type=`, which dropped the 72 hired swords the bestiary held before they became their
own catalogue. `?view=summary` sends each row without its description and its item (the beast's Animal item and
prices, which the default row carries). Without them, the list is unchanged.
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.core.catalogue.payloads import BADGES

from .catalogue_support import BESTIARY, CatalogueTestCase, make_entry

DEFAULT_KEYS = [
    "id",
    "campaign_id",
    "name",
    "kind",
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
    "has_profile",
    "gains_xp",
    "rating_bonus",
    "available_in_shop",
    "item",  # the beast's Animal item: its id, grade and prices (the bestiary rewrite step 3)
    *BADGES,  # CAT-NEW-03, PR C
]


class BestiaryListViewsTests(CatalogueTestCase):
    """The book's Warhound (a creature) and Warhorse (a mount), plus a campaign creature."""

    def setUp(self) -> None:
        super().setUp()
        make_entry(BESTIARY, "Warhorse", kind="mount")
        make_entry(BESTIARY, "Rat Ogre", campaign=self.campaign, description="Big.")

    def rows(self, query: str = "") -> list[dict[str, Any]]:
        response = self.get_as(self.player, f"{BESTIARY.list_url(self.campaign)}{query}")
        self.assertEqual(response.status_code, 200)
        rows: list[dict[str, Any]] = response.json()
        return rows

    def test_the_default_list_is_unchanged(self):
        rows = self.rows("&view=full")

        self.assertEqual([(row["name"], row["kind"]) for row in rows], [("Rat Ogre", "creature"), ("Warhorse", "mount"), ("Warhound", "creature")])  # fmt: skip
        self.assertEqual([list(row) for row in rows], [DEFAULT_KEYS] * 3)
        self.assertEqual(rows, self.rows())

    def test_the_summary_view_drops_the_description_and_keeps_the_rest_in_order(self):
        rows = self.rows("&view=summary&kind=creature")

        self.assertEqual([row["name"] for row in rows], ["Rat Ogre", "Warhound"])
        self.assertEqual([list(row) for row in rows], [[key for key in DEFAULT_KEYS if key not in ("description", "item")]] * 2)  # fmt: skip

    def test_the_views_cost_what_the_default_list_costs(self):
        def count(query: str) -> int:
            with CaptureQueriesContext(connection) as captured:
                self.rows(query)
            return len(captured)

        self.assertEqual(count("&view=summary&kind=creature"), count(""))
