"""The bestiary by kind (the bestiary rewrite step 3): every entry is a mount, a pet or a creature.

`kind` replaces the free-text `type`. `has_profile` off hides the stat line: the stats are stored at 0 and the save
empty, never shown as a profile of zeros. `gains_xp` matters for creatures, `rating_bonus` for mounts (what the rider
adds), and `available_in_shop` lists the beast's Animal item in the shop. The list filters by kind.
"""

from typing import Any

from django.db import IntegrityError, transaction

from apps.bestiary.models import BestiaryEntry
from apps.core.catalogue.payloads import BADGES, STAT_FIELDS
from apps.items.tests.catalogue_support import BESTIARY, STATS, CatalogueTestCase, make_entry

BEAST_FIELDS = ["has_profile", "gains_xp", "rating_bonus", "available_in_shop"]
NO_PROFILE = {**{stat: 0 for stat in STAT_FIELDS}, "armour_save": None}


class BestiaryKindModelTests(CatalogueTestCase):
    def test_an_entry_has_a_kind_and_the_type_is_gone(self):
        beast = make_entry(BESTIARY, "Mule", kind="mount")

        self.assertEqual(
            (beast.kind, beast.has_profile, beast.gains_xp, beast.rating_bonus, beast.available_in_shop),
            ("mount", True, False, None, False),
        )
        self.assertFalse(any(field.name == "type" for field in BestiaryEntry._meta.fields))

    def test_the_database_refuses_an_unknown_kind(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            make_entry(BESTIARY, "Dragon", kind="dragon")


class BestiaryKindListTests(CatalogueTestCase):
    """The book's Warhound (a creature) and Warhorse (a mount, rating +5), and the campaign's Raven (a pet with no
    profile)."""

    def setUp(self) -> None:
        super().setUp()
        make_entry(BESTIARY, "Warhorse", kind="mount", rating_bonus=5, available_in_shop=True)
        make_entry(BESTIARY, "Raven", campaign=self.campaign, kind="pet", has_profile=False, **NO_PROFILE)

    def rows(self, query: str = "") -> list[dict[str, Any]]:
        response = self.get_as(self.player, f"{BESTIARY.list_url(self.campaign)}{query}")
        self.assertEqual(response.status_code, 200, response.data)
        rows: list[dict[str, Any]] = response.json()
        return rows

    def test_a_row_says_its_kind_and_the_beast_fields(self):
        rows = {row["name"]: row for row in self.rows()}

        self.assertEqual(list(rows), ["Raven", "Warhorse", "Warhound"])
        self.assertEqual(
            {name: [row["kind"], *(row[field] for field in BEAST_FIELDS)] for name, row in rows.items()},
            {
                "Raven": ["pet", False, False, None, False],
                "Warhorse": ["mount", True, False, 5, True],
                "Warhound": ["creature", True, False, None, False],
            },
        )
        self.assertNotIn("type", rows["Warhorse"])
        self.assertEqual(list(rows["Warhorse"])[:4], ["id", "campaign_id", "name", "kind"])
        self.assertEqual(list(rows["Warhorse"])[-len(BADGES) :], list(BADGES))

    def test_the_list_filters_by_kind_one_or_several_in_any_case(self):
        self.assertEqual([row["name"] for row in self.rows("&kind=mount")], ["Warhorse"])
        self.assertEqual([row["name"] for row in self.rows("&kind=Pet,creature")], ["Raven", "Warhound"])
        self.assertEqual(len(self.rows("&kind=")), 3)

    def test_an_unknown_kind_is_refused(self):
        response = self.get_as(self.player, f"{BESTIARY.list_url(self.campaign)}&kind=mount,dragon")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "invalid")
        self.assertEqual(list(response.json()["fields"]), ["kind"])

    def test_the_kind_filter_runs_before_the_list_rule(self):
        # the campaign's version of the book Warhound is a mount: it replaces the book creature for every filter
        make_entry(BESTIARY, "War Dog", campaign=self.campaign, kind="mount", replaces=self.warhound)

        self.assertEqual([row["name"] for row in self.rows("&kind=creature")], [])
        self.assertEqual([row["name"] for row in self.rows("&kind=mount")], ["War Dog", "Warhorse"])

    def test_the_summary_view_keeps_the_kind_and_drops_the_description(self):
        rows = self.rows("&view=summary&kind=pet")

        self.assertEqual([(row["name"], row["kind"], row["has_profile"]) for row in rows], [("Raven", "pet", False)])
        self.assertNotIn("description", rows[0])


class BestiaryKindWriteTests(CatalogueTestCase):
    def create(self, name: str, **body: Any) -> Any:
        return self.create_as(self.owner, BESTIARY, name, **body)

    def test_a_create_needs_a_known_kind(self):
        missing = self.post_as(self.owner, BESTIARY.list_url(), {"campaign_id": self.campaign.id, "name": "Rat", **STATS})  # fmt: skip
        unknown = self.create("Rat", kind="monster")

        self.assertEqual((missing.status_code, list(missing.data)), (400, ["kind"]))
        self.assertEqual((unknown.status_code, list(unknown.data)), (400, ["kind"]))
        self.assertFalse(BestiaryEntry.objects.filter(name="Rat").exists())

    def test_a_create_takes_the_beast_fields(self):
        created = self.create(
            "Rhinox", kind="mount", rating_bonus=20, gains_xp=False, available_in_shop=True, has_profile=True
        )

        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual([created.data[key] for key in ("kind", *BEAST_FIELDS)], ["mount", True, False, 20, True])

    def test_a_beast_without_a_profile_keeps_its_stats_at_zero(self):
        created = self.create("Raven", kind="pet", has_profile=False, armour_save=6, movement=8)

        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual({key: created.data[key] for key in NO_PROFILE}, NO_PROFILE)
        self.assertFalse(created.data["has_profile"])

    def test_switching_the_profile_off_stores_the_stats_at_zero(self):
        beast = make_entry(BESTIARY, "Polecat", campaign=self.campaign, kind="pet", armour_save=6)

        off = self.patch_as(self.owner, BESTIARY.detail_url(beast.id), {"has_profile": False, "movement": 7})
        later = self.patch_as(self.owner, BESTIARY.detail_url(beast.id), {"description": "Sly.", "attacks": 2})

        self.assertEqual((off.status_code, {key: off.data[key] for key in NO_PROFILE}), (200, NO_PROFILE))
        self.assertEqual({key: later.data[key] for key in NO_PROFILE}, NO_PROFILE)

    def test_a_rating_bonus_is_a_whole_number_from_zero_or_none(self):
        negative = self.create("Pony", kind="mount", rating_bonus=-1)
        cleared = self.create("Donkey", kind="mount", rating_bonus=None)

        self.assertEqual((negative.status_code, list(negative.data)), (400, ["rating_bonus"]))
        self.assertEqual((cleared.status_code, cleared.data["rating_bonus"]), (201, None))

    def test_a_campaign_may_change_a_book_entrys_kind_in_its_version(self):
        response = self.patch_as(
            self.owner, BESTIARY.detail_url(self.warhound.id), {"campaign_id": self.campaign.id, "kind": "mount"}
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual((response.data["kind"], response.data["replaces"]), ("mount", self.warhound.id))
        self.assertEqual(response.data["book"]["changes"], {"kind": "creature"})

    def test_a_taken_names_matches_carry_no_type(self):
        refused = self.create("Warhound", kind="creature")

        self.assertEqual((refused.status_code, refused.data["code"]), (400, "name_taken"))
        self.assertEqual([match["type"] for match in refused.data["matches"]], [None])
