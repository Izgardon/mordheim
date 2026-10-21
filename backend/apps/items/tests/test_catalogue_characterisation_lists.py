"""Characterisation: the catalogue lists and details, and how a campaign's entries replace book entries (pass 5).

With `?campaign_id=`, each list returns the campaign's rows, then the book rows it has no version of and hasn't
removed (BUG-18 flipped in PR C: it was by name, whatever the type). Without it, only book rows. A list for a campaign
the caller isn't in is a 404 (CAT-TEST-01); a campaign id that isn't a whole number is a 400 (BUG-79, CAT-TEST-11).
"""

from typing import Any

from apps.items.models import Item, ItemProperty
from apps.restrictions.models import Restriction

from .catalogue_support import (
    BESTIARY,
    HIRED_SWORDS,
    INFILTRATION_TYPES,
    ITEMS,
    KINDS,
    RACES,
    SKILLS,
    SPECIALS,
    SPELLS,
    CatalogueKind,
    CatalogueTestCase,
    make_entry,
)

# Every catalogue list that takes ?campaign_id=.
LIST_URLS = {
    **{kind.key: kind.list_url() for kind in KINDS},
    "restrictions": "/api/restrictions/",
    "item_properties": "/api/item-properties/",
}


class CatalogueListAccessTests(CatalogueTestCase):
    def test_a_campaign_list_needs_membership_and_the_book_list_needs_none(self):
        # CAT-TEST-01
        make_entry(ITEMS, "House blade", campaign=self.campaign)
        for key, url in LIST_URLS.items():
            with self.subTest(list=key):
                refused = self.get_as(self.outsider, f"{url}?campaign_id={self.campaign.id}")
                book = self.get_as(self.outsider, url)

                self.assertEqual((refused.status_code, refused.data), (404, {"detail": "Not found"}))
                self.assertEqual(book.status_code, 200)
        self.assertNotIn("House blade", [row["name"] for row in self.get_as(self.outsider, ITEMS.list_url()).json()])

    def test_a_campaign_id_that_is_not_a_number_is_a_400(self):
        # BUG-79, CAT-TEST-11 (was pinned: a 500 on every list; flipped in PR A: one parse_campaign_id)
        detail = "campaign_id must be a campaign's id."
        refused = {"detail": detail, "code": "invalid", "fields": {"campaign_id": [detail]}}
        for key, url in LIST_URLS.items():
            for value in ("abc", "1.5", "-3"):
                with self.subTest(list=key, campaign_id=value):
                    response = self.get_as(self.player, f"{url}?campaign_id={value}")
                    self.assertEqual((response.status_code, response.json()), (400, refused))

    def test_a_catalogue_write_naming_a_campaign_that_is_not_a_number_is_a_400(self):
        # BUG-79: the writes read the body's campaign_id the same way
        writes = [kind.list_url() for kind in KINDS] + ["/api/item-properties/"]
        for url in writes:
            with self.subTest(url=url):
                response = self.post_as(self.owner, url, {"campaign_id": "abc", "name": "Bad", "type": "Weapon"})
                self.assertEqual((response.status_code, response.json()["code"]), (400, "invalid"))

    def test_another_campaigns_entry_is_a_404_and_a_book_entry_is_open_to_anyone(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                theirs = make_entry(kind, f"Their {kind.key}", campaign=self.elsewhere)
                book = make_entry(kind, f"Book {kind.key}")
                if kind is RACES:  # races have no detail read: GET is not allowed
                    self.assertEqual(self.get_as(self.player, kind.detail_url(book.id)).status_code, 405)
                    continue
                self.assertEqual(self.get_as(self.player, kind.detail_url(theirs.id)).status_code, 404)
                self.assertEqual(self.get_as(self.outsider, kind.detail_url(theirs.id)).status_code, 200)
                self.assertEqual(self.get_as(self.player, kind.detail_url(book.id)).status_code, 200)
                self.assertEqual(self.get_as(self.player, kind.detail_url(999999)).status_code, 404)

    def test_a_marienburg_campaign_stores_no_type_and_lists_the_same_catalogue(self):
        # CAT-NEW-04 (PR A adds the campaign_type tables with no data and no filtering): today the create dialog's
        # type only switches on encampments and locations; mim-items.json is never seeded
        created = self.post_as(self.owner, "/api/campaigns/", {"name": "Marienburg", "campaign_type": "marienburg"})
        marienburg = self.get_as(self.owner, f"/api/campaigns/{created.data['id']}/").json()

        self.assertNotIn("campaign_type", marienburg)
        self.assertEqual(self.listed(self.owner, ITEMS, created.data["id"]), self.listed(self.owner, ITEMS))


class CatalogueMergeTests(CatalogueTestCase):
    """BUG-18, CAT-TEST-02: only a campaign's version of a book entry replaces it; a campaign entry that merely shares
    its name, of any type, replaces nothing (was: it hid every book entry of its name; flipped in PR C)."""

    def test_any_player_reprices_a_book_item_for_the_whole_campaign_and_can_price_it_back(self):
        # BUG-18 (was pinned: a custom "Axe" hid the book Axe by name; flipped in PR C: an edit of the book Axe makes
        # the campaign's version of it, which Buy again charges, and a Revert takes it back). Who may (BUG-15)
        # flipped in PR A: edit_catalogue edits it; deleting needs delete_catalogue
        edited = self.patch_as(self.player, ITEMS.detail_url(self.book_axe.id), {"campaign_id": self.campaign.id, "availabilities": [{"cost": 25}]})  # fmt: skip
        self.post_as(self.player, f"/api/warbands/{self.warband.id}/purchases/", {"item_id": self.book_axe.id, "target_type": "stash"})  # fmt: skip

        rows = self.get_as(self.rival, ITEMS.list_url(self.campaign)).json()
        bought = self.get_as(self.player, f"/api/warbands/{self.warband.id}/trades/").json()

        self.assertEqual(edited.status_code, 200)
        self.assertEqual([(row["id"], row["availabilities"][0]["cost"]) for row in rows if row["name"] == "Axe"], [(edited.data["id"], 25)])  # fmt: skip
        self.assertIn(("Buy", "Axe", -25), [(row["action"], row["description"], row["price"]) for row in bought])  # fmt: skip
        self.assertEqual(self.patch_as(self.rival, ITEMS.detail_url(edited.data["id"]), {"availabilities": [{"cost": 5}]}).status_code, 200)  # fmt: skip
        self.assertEqual(self.post_as(self.rival, f"{ITEMS.detail_url(edited.data['id'])}revert/").status_code, 200)
        self.assertEqual([row["id"] for row in self.get_as(self.rival, ITEMS.list_url(self.campaign)).json() if row["name"] == "Axe"], [self.book_axe.id])  # fmt: skip

    def test_a_campaign_axe_of_another_type_replaces_nothing(self):
        # BUG-18 (was pinned: it hid the book Axe; flipped in PR C)
        make_entry(ITEMS, "Axe", campaign=self.campaign, type="Miscellaneous", subtype="", cost=25)

        rows = self.get_as(self.player, ITEMS.list_url(self.campaign)).json()

        self.assertEqual(
            [(row["name"], row["type"], row["campaign_id"]) for row in rows],
            [
                ("Axe", "Miscellaneous", self.campaign.id),
                ("Axe", "Weapon", None),
                ("Heavy Armour", "Armour", None),
                ("Sword", "Weapon", None),
            ],
        )

    def test_a_version_of_one_infiltration_replaces_that_one_alone(self):
        # BUG-18 (was pinned: one campaign "Infiltration" hid all six book skills of that name; flipped in PR C)
        self.assertEqual(self.listed(self.player, SKILLS), ["Infiltration"] * 6 + ["Sprint"])
        make_entry(SKILLS, "Infiltration", campaign=self.campaign, type="Combat")  # a custom one: hides none
        make_entry(SKILLS, "Sneaking", campaign=self.campaign, type="Skaven", replaces=self.infiltration[2])

        rows = self.get_as(self.player, SKILLS.list_url(self.campaign)).json()

        listed = [(row["name"], row["type"]) for row in rows]
        self.assertEqual(listed[:2], [("Infiltration", "Combat"), ("Sneaking", "Skaven")])
        self.assertCountEqual(listed[2:], [("Infiltration", kind) for kind in INFILTRATION_TYPES if kind != "Skaven"] + [("Sprint", "Speed")])  # fmt: skip

    def test_every_kind_replaces_a_book_entry_only_by_a_version(self) -> None:
        # BUG-18 (was pinned: every kind hid book entries by name; flipped in PR C)
        cases: list[tuple[CatalogueKind, Any, dict[str, Any]]] = [
            (SPELLS, self.lifestealer[0], {"type": "Lesser Magic"}),
            (SPECIALS, self.large, {"type": "Ability"}),
            (RACES, self.human, {}),
            (BESTIARY, self.warhound, {"type": "Monster"}),
            (HIRED_SWORDS, self.ogre, {}),
        ]
        for kind, book, fields in cases:
            with self.subTest(kind=kind.key):
                entry = book.bestiary_entry if kind is HIRED_SWORDS else book
                same_name = make_entry(kind, entry.name, campaign=self.campaign, **fields)
                listed = [row["id"] for row in self.get_as(self.player, kind.list_url(self.campaign)).json()]
                self.assertLessEqual({same_name.id, book.id}, set(listed))
                version = make_entry(kind, f"New {entry.name}", campaign=self.campaign, replaces=entry, **fields)

                listed = [row["id"] for row in self.get_as(self.player, kind.list_url(self.campaign)).json()]

                self.assertNotIn(book.id, listed)
                self.assertLessEqual({same_name.id, version.id}, set(listed))

    def test_restrictions_hide_book_rows_by_text(self):
        Restriction.objects.create(type="Warband Group", restriction="Mercenaries", campaign=self.campaign)

        rows = self.get_as(self.player, f"/api/restrictions/?campaign_id={self.campaign.id}").json()

        self.assertEqual(
            [(row["restriction"], row["type"], row["campaign"]) for row in rows],
            [("Mercenaries", "Warband Group", self.campaign.id)],
        )

    def test_item_properties_list_campaign_and_book_rows_side_by_side(self):
        ItemProperty.objects.create(name="Parry", type="Weapon", campaign=self.campaign)
        ItemProperty.objects.create(name="Parry", type="Weapon", campaign=self.elsewhere)

        rows = self.get_as(self.player, f"/api/item-properties/?campaign_id={self.campaign.id}").json()

        self.assertCountEqual(
            [(row["name"], row["campaign_id"]) for row in rows], [("Parry", None), ("Parry", self.campaign.id)]
        )

    def test_campaign_rows_come_first_then_book_rows_each_by_name(self):
        make_entry(ITEMS, "Zweihander", campaign=self.campaign)
        make_entry(ITEMS, "Club", campaign=self.campaign)

        self.assertEqual(self.listed(self.player, ITEMS), ["Club", "Zweihander", "Axe", "Heavy Armour", "Sword"])

    def test_only_this_campaigns_entries_replace_book_entries(self):
        make_entry(ITEMS, "Axe", campaign=self.elsewhere, cost=99)

        rows = self.get_as(self.player, ITEMS.list_url(self.campaign)).json()

        self.assertEqual([(row["name"], row["campaign_id"]) for row in rows][0], ("Axe", None))
        self.assertEqual(rows[0]["availabilities"][0]["cost"], 5)

    def test_pending_placeholders_are_left_out_of_the_lists(self):
        self.assertNotIn("New Skill", self.listed(self.player, SKILLS))
        self.assertNotIn("New Skill", [row["name"] for row in self.get_as(self.player, SKILLS.list_url()).json()])

    def test_items_list_with_their_prices_restrictions_and_properties(self):
        sword = next(row for row in self.get_as(self.player, ITEMS.list_url(self.campaign)).json() if row["name"] == "Sword")  # fmt: skip

        self.assertEqual(
            {key: sword[key] for key in ("campaign_id", "type", "subtype", "generated_effect_key", "bestiary_entry")},
            {
                "campaign_id": None,
                "type": "Weapon",
                "subtype": "Melee",
                "generated_effect_key": None,
                "bestiary_entry": None,
            },  # fmt: skip
        )
        self.assertEqual(sword["properties"], [{"id": self.parry.id, "name": "Parry", "type": "Weapon"}])
        [availability] = sword["availabilities"]
        self.assertEqual((availability["cost"], availability["rarity"], availability["variable_cost"]), (10, 2, None))
        self.assertEqual(
            availability["restrictions"],
            [
                {
                    "restriction": {"id": self.mercenaries.id, "type": "Warband", "restriction": "Mercenaries"},
                    "additional_note": "",
                }
            ],  # fmt: skip
        )

    def test_type_and_search_filter_before_the_merge(self):
        make_entry(ITEMS, "Axe", campaign=self.campaign, type="Miscellaneous", subtype="")

        weapons = self.get_as(self.player, f"{ITEMS.list_url(self.campaign)}&type=weapon").json()
        searched = self.get_as(self.player, f"{ITEMS.list_url(self.campaign)}&search=AX").json()

        # BUG-18 (was pinned: searched by name, the Misc Axe hid the book Axe; flipped in PR C: it replaces nothing)
        self.assertEqual([(row["name"], row["campaign_id"]) for row in weapons], [("Axe", None), ("Sword", None)])
        self.assertEqual(
            [(row["name"], row["type"]) for row in searched], [("Axe", "Miscellaneous"), ("Axe", "Weapon")]
        )
        self.assertEqual(Item.objects.filter(name="Axe").count(), 2)
