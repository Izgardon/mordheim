"""Characterisation: the catalogue lists and details, and how a campaign's entries replace book entries (pass 5).

With `?campaign_id=`, each list returns the campaign's rows, then the book rows whose name no campaign row uses
(BUG-18: by name only, whatever the type). Without it, only book rows. A list for a campaign the caller isn't in is a
404 (CAT-TEST-01); a campaign id that isn't a whole number is a 400 (BUG-79, CAT-TEST-11).
"""

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
    """BUG-18 (CAT-TEST-02 baseline): a campaign entry hides every book entry of its name, whatever its type."""

    def test_any_player_reprices_a_book_item_for_the_whole_campaign_and_can_price_it_back(self):
        # Characterises current behaviour (BUG-18, pinned; flips in PR C: a version of the Axe, with Revert): the
        # "Axe 25 gc" case. Who may (BUG-15) flipped in PR A: edit_catalogue edits it back; deleting needs
        # delete_catalogue
        created = self.create_as(self.player, ITEMS, "Axe")  # 25 gc
        self.post_as(self.player, f"/api/warbands/{self.warband.id}/purchases/", {"item_id": self.book_axe.id, "target_type": "stash"})  # fmt: skip

        rows = self.get_as(self.rival, ITEMS.list_url(self.campaign)).json()
        bought = self.get_as(self.player, f"/api/warbands/{self.warband.id}/trades/").json()

        self.assertEqual(created.status_code, 201)
        self.assertEqual([(row["id"], row["availabilities"][0]["cost"]) for row in rows if row["name"] == "Axe"], [(created.data["id"], 25)])  # fmt: skip
        self.assertIn(("Buy", "Axe", -25), [(row["action"], row["description"], row["price"]) for row in bought])  # fmt: skip
        self.assertEqual(self.patch_as(self.rival, ITEMS.detail_url(created.data["id"]), {"availabilities": [{"cost": 5}]}).status_code, 200)  # fmt: skip
        self.assertEqual(self.delete_as(self.player, ITEMS.detail_url(created.data["id"])).status_code, 403)

    def test_a_campaign_axe_of_another_type_hides_the_book_axe(self):
        # Characterises current behaviour (BUG-18, pinned; flips in PR C: only a version replacing the Axe hides it)
        make_entry(ITEMS, "Axe", campaign=self.campaign, type="Miscellaneous", subtype="", cost=25)

        rows = self.get_as(self.player, ITEMS.list_url(self.campaign)).json()

        self.assertEqual(
            [(row["name"], row["type"], row["campaign_id"]) for row in rows],
            [("Axe", "Miscellaneous", self.campaign.id), ("Heavy Armour", "Armour", None), ("Sword", "Weapon", None)],
        )

    def test_one_campaign_infiltration_hides_all_six_book_skills_of_that_name(self):
        # Characterises current behaviour (BUG-18, pinned; flips in PR C)
        self.assertEqual(self.listed(self.player, SKILLS), ["Infiltration"] * 6 + ["Sprint"])

        make_entry(SKILLS, "Infiltration", campaign=self.campaign, type="Combat")

        rows = self.get_as(self.player, SKILLS.list_url(self.campaign)).json()
        self.assertEqual(
            [(row["name"], row["type"]) for row in rows], [("Infiltration", "Combat"), ("Sprint", "Speed")]
        )
        self.assertEqual(len(INFILTRATION_TYPES), 6)

    def test_every_kind_hides_book_entries_by_name(self):
        # Characterises current behaviour (BUG-18, pinned; flips in PR C)
        cases = [
            (SPELLS, "Lifestealer", {"type": "Lesser Magic"}),
            (SPECIALS, "Large", {"type": "Ability"}),
            (RACES, "Human", {}),
            (BESTIARY, "Warhound", {"type": "Monster"}),
            (HIRED_SWORDS, "Ogre Bodyguard", {}),
        ]
        for kind, name, fields in cases:
            with self.subTest(kind=kind.key):
                self.assertIn(name, self.listed(self.player, kind))
                make_entry(kind, name, campaign=self.campaign, **fields)

                rows = self.get_as(self.player, kind.list_url(self.campaign)).json()

                named = [row for row in rows if kind.row_name(row) == name]
                self.assertEqual([row["campaign_id"] for row in named], [self.campaign.id])

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

        # Characterises current behaviour (BUG-18, pinned; flips in PR C): filtered by type, the Misc Axe is gone
        # before the merge and the book Axe is back; searched by name, the Misc Axe still hides it
        self.assertEqual([(row["name"], row["campaign_id"]) for row in weapons], [("Axe", None), ("Sword", None)])
        self.assertEqual([(row["name"], row["type"]) for row in searched], [("Axe", "Miscellaneous")])
        self.assertEqual(Item.objects.filter(name="Axe").count(), 2)
