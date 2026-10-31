"""What catalogue writes store and accept (pass 5; BUG-53, BUG-145, BUG-146, BUG-147, SEC-06, SEC-07).

Item writes take price rows (with who may buy each) and rules as nested input; bestiary and hired-sword writes take skill,
special, spell and item ids and who may hire. Since PR A every id must be the book's or the writer's campaign's (SEC-07's
catalogue half, CAT-TEST-16): another campaign's id is refused like an unknown one. Writes that fail part-way are
in `test_catalogue_transactions.py`; what they tell the other members (BUG-80), in `test_catalogue_events.py`.
"""

from apps.bestiary.models import BestiaryEntry, WarbandBestiaryFavourite
from apps.core.testing import book_warband_type
from apps.hirelings.fees import make_fee
from apps.hirelings.models import HiredSword
from apps.items.models import Item, ItemAvailability, ItemRule
from apps.races.models import Race
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell
from apps.warbands.models import WarbandGroup, WarbandType

from .catalogue_support import BESTIARY, HIRED_SWORDS, ITEMS, RACES, CatalogueTestCase, make_entry


class ItemWriteTests(CatalogueTestCase):
    def test_an_item_is_created_with_its_rules_price_rows_and_who_may_buy_each(self):
        skaven = book_warband_type("Skaven")
        humans = WarbandGroup.objects.create(slug="humans", name="Humans", kind="race")
        availabilities = [
            {
                "label": "Brace",
                "cost": 30,
                "rarity": 9,
                "for_everyone": False,
                "note": "Heroes only",
                "warbands": [{"warband_type_id": skaven.id}, {"warband_group_id": humans.id}],
            },  # fmt: skip
            {"dice": 2, "warbands": [{"warband_type_id": skaven.id, "excluded": True}]},
        ]
        table = [{"columns": ["D6", "Result"], "rows": [["1-3", "Nothing"], ["4-6", "A crown"]]}]
        rules = [{"rule_id": self.parry.id}, {"name": "Lucky find", "text": "Roll a D6.", "table": table}]

        response = self.create_as(self.player, ITEMS, "Halberd", availabilities=availabilities, rules=rules)

        self.assertEqual(response.status_code, 201, response.data)
        body = response.data
        self.assertEqual((body["strength"], body["range"], body["save"]), ("As user", "Close combat", None))
        self.assertEqual(
            [(rule["name"], rule["shared"], rule["table"]) for rule in body["rules"]],
            [("Parry", True, []), ("Lucky find", False, table)],
        )
        # a missing cost is 0 and a missing rarity is Common; rows keep the order they were sent in, for everyone unless
        # they say otherwise
        self.assertEqual(
            [
                (row["label"], row["cost"], row["dice"], row["rarity"], row["for_everyone"], row["note"])
                for row in body["availabilities"]
            ],  # fmt: skip
            [("Brace", 30, None, 9, False, "Heroes only"), ("", 0, 2, None, True, "")],
        )
        self.assertEqual(
            [[(line["name"], line["excluded"]) for line in row["warbands"]] for row in body["availabilities"]],
            [[("Skaven", False), ("Humans", False)], [("Skaven", True)]],
        )

    def test_unknown_rule_and_warband_ids_are_refused(self):
        # SEC-07 (they used to be dropped silently): an unknown id and another campaign's read the same, a 400
        availabilities = [{"cost": 5, "warbands": [{"warband_group_id": 999999}]}]

        response = self.create_as(self.owner, ITEMS, "Club", availabilities=availabilities, rules=[{"rule_id": 999999}])

        unknown = ['Invalid pk "999999" - object does not exist.']
        self.assertEqual((response.status_code, response.json()), (400, {"rules": unknown, "availabilities": unknown}))
        self.assertFalse(Item.objects.filter(name="Club").exists())

    def test_a_who_can_line_names_a_type_or_a_group(self):
        both = [{"cost": 5, "warbands": [{"warband_type_id": book_warband_type().id, "warband_group_id": 1}]}]
        response = self.create_as(self.owner, ITEMS, "Club", availabilities=both, rules=[{"text": "No name"}])

        self.assertEqual(response.status_code, 400)
        self.assertEqual(sorted(response.json()), ["availabilities", "rules"])

    def test_an_edit_replaces_the_price_rows_and_rules_it_sends_and_keeps_the_rest(self):
        item = make_entry(ITEMS, "Flail", campaign=self.campaign, cost=15)
        original = item.availabilities.get().id
        url = ITEMS.detail_url(item.id)

        renamed = self.patch_as(self.owner, url, {"name": "Morning Star"})
        repriced = self.patch_as(self.owner, url, {"availabilities": [{"cost": 20, "rarity": 3}], "rules": [{"rule_id": self.parry.id}]})  # fmt: skip

        self.assertEqual(renamed.data["availabilities"][0]["id"], original)
        [availability] = repriced.data["availabilities"]
        # the old row is deleted and a new one written (ids churn, CAT-BUG-08)
        self.assertNotEqual(availability["id"], original)
        self.assertEqual((availability["cost"], availability["rarity"]), (20, 3))
        self.assertEqual([rule["name"] for rule in repriced.data["rules"]], ["Parry"])
        self.assertFalse(ItemAvailability.objects.filter(id=original).exists())

    def test_an_items_save_is_written_and_read_as_save_after_its_range(self):
        # IMP-85: the save_value column is "save" in every item payload, declared without a field named save
        created = self.create_as(self.owner, ITEMS, "Buckler", type="Armour", subtype="Shield", save="6+")
        edited = self.patch_as(self.owner, ITEMS.detail_url(created.data["id"]), {"save": "5+"})

        keys = list(created.data)
        self.assertEqual(keys[keys.index("range") + 1], "save")
        self.assertEqual((created.data["save"], edited.data["save"]), ("6+", "5+"))
        self.assertEqual(Item.objects.get(id=created.data["id"]).save_value, "5+")

    def test_an_item_can_be_moved_to_no_campaign_by_neither_create_nor_edit(self):
        created = self.post_as(self.owner, ITEMS.list_url(), {**ITEMS.body("Pike", self.campaign), "campaign": None})
        edited = self.patch_as(
            self.owner, ITEMS.detail_url(created.data["id"]), {"campaign": None, "campaign_id": None}
        )

        self.assertEqual(
            (created.data["campaign_id"], edited.data["campaign_id"]), (self.campaign.id, self.campaign.id)
        )

    def test_an_animal_item_comes_from_the_bestiary_alone(self):
        # BUG-146 (was pinned: the raw id reached the relation, which needs an instance, so every write was a 500;
        # flipped in PR A: a scoped related field). The bestiary rewrite step 3 retired `bestiary_entry_id`: the
        # bestiary writes each beast's one Animal item, so the items routes make none and link no beast
        created = self.create_as(self.owner, ITEMS, "Hound", type="Animal", bestiary_entry_id=self.warhound.id)
        linked = self.create_as(self.owner, ITEMS, "Leash", type="Equipment", bestiary_entry_id=self.warhound.id)

        self.assertEqual((created.status_code, list(created.data)), (400, ["type"]))
        self.assertEqual((linked.status_code, linked.data["bestiary_entry"]), (201, None))  # the id is ignored
        self.assertFalse(Item.objects.filter(name="Hound").exists())


class CampaignScopeOfWriteIdsTests(CatalogueTestCase):
    """SEC-07's catalogue half (CAT-TEST-16): ids from another campaign are linked, and their text then reads back."""

    def test_an_item_cannot_link_another_campaigns_shared_rule_or_warband_type(self):
        # SEC-07 (was pinned: both were linked and their text read back; flipped in PR A: scoped ids, a 400 that
        # reads like an unknown id, and nothing written); the book's and this campaign's are linked
        their_rule = ItemRule.objects.create(name="Secret rule", campaign=self.elsewhere)
        their_type = WarbandType.objects.create(name="Their warband", slug="theirs", campaign=self.elsewhere)
        our_rule = ItemRule.objects.create(name="House rule", campaign=self.campaign)
        availabilities = [{"cost": 5, "for_everyone": False, "warbands": [{"warband_type_id": their_type.id}]}]
        rules = [{"rule_id": their_rule.id}]

        refused = self.create_as(self.player, ITEMS, "Spy glass", availabilities=availabilities, rules=rules)
        linked = self.create_as(self.player, ITEMS, "Telescope", rules=[{"rule_id": our_rule.id}, {"rule_id": self.parry.id}])  # fmt: skip

        self.assertEqual((refused.status_code, sorted(refused.data)), (400, ["availabilities", "rules"]))
        self.assertEqual(refused.data["rules"], [f'Invalid pk "{their_rule.id}" - object does not exist.'])
        self.assertFalse(Item.objects.filter(name="Spy glass").exists())
        self.assertEqual([rule["name"] for rule in linked.data["rules"]], ["House rule", "Parry"])

    def test_a_bestiary_entry_cannot_link_another_campaigns_skills_specials_spells_or_items(self):
        # SEC-07, CAT-TEST-16 (was pinned: all four were linked and their text read back; flipped in PR A: a 400 that
        # reads like unknown ids, with nothing written)
        skill = Skill.objects.create(name="Their skill", type="Combat", description="Secret", campaign=self.elsewhere)
        special = Special.objects.create(name="Their special", type="Ability", campaign=self.elsewhere)
        spell = Spell.objects.create(name="Their spell", type="Magic", campaign=self.elsewhere)
        item = make_entry(ITEMS, "Their blade", campaign=self.elsewhere)
        links = {
            "skill_ids": [skill.id],
            "special_ids": [special.id],
            "spell_ids": [spell.id],
            "item_entries": [{"item_id": item.id, "quantity": 2}],
        }

        created = self.create_as(self.owner, BESTIARY, "Spy", **links)

        self.assertEqual(created.status_code, 400)
        self.assertEqual(
            created.json(),
            {
                key: [f'Invalid pk "{pk}" - object does not exist.']
                for key, pk in zip(links, (skill.id, special.id, spell.id, item.id), strict=True)
            },  # fmt: skip
        )
        self.assertFalse(BestiaryEntry.objects.filter(name="Spy").exists())

    def test_a_hired_sword_cannot_name_another_campaigns_warband_type(self):
        # SEC-07 (was pinned for restrictions: linked, and its text read back; flipped in PR A)
        theirs = WarbandType.objects.create(name="Their warband", slug="theirs", campaign=self.elsewhere)
        ours = WarbandType.objects.create(name="Our warband", slug="ours", campaign=self.campaign)

        response = self.create_as(self.owner, HIRED_SWORDS, "Mole", warbands=[{"warband_type_id": theirs.id}])
        hired = self.create_as(self.owner, HIRED_SWORDS, "Vole", for_everyone=False, warbands=[{"warband_type_id": ours.id}, {"warband_type_id": self.mercenaries.id, "excluded": True}])  # fmt: skip

        self.assertEqual(response.json(), {"warbands": [f'Invalid pk "{theirs.id}" - object does not exist.']})
        self.assertFalse(HiredSword.objects.filter(name="Mole").exists())
        self.assertEqual(
            [(line["name"], line["excluded"]) for line in hired.data["warbands"]],
            [("Our warband", False), ("Mercenaries", True)],
        )
        self.assertFalse(hired.data["for_everyone"])

    def test_a_warband_cannot_favourite_another_campaigns_bestiary_entry_or_read_it(self):
        # SEC-07 (was pinned: favourited, and its stats read back; flipped in PR A: not found, and a favourite left
        # over from before is no longer listed)
        theirs = make_entry(BESTIARY, "Their beast", campaign=self.elsewhere, description="Secret stats")
        WarbandBestiaryFavourite.objects.create(warband=self.warband, bestiary_entry=theirs)
        url = f"/api/warbands/{self.warband.id}/bestiary-favourites/"

        added = self.post_as(self.player, url, {"bestiary_entry_id": theirs.id})
        garbage = self.post_as(self.player, url, {"bestiary_entry_id": "abc"})
        listed = self.get_as(self.player, url).json()

        self.assertEqual((added.status_code, added.data), (404, {"detail": "Bestiary entry not found"}))
        self.assertEqual(garbage.status_code, 404)
        self.assertEqual(listed, [])

    def test_favourites_are_the_warband_owners_or_a_manage_warbands_holders(self):
        url = f"/api/warbands/{self.warband.id}/bestiary-favourites/"
        body = {"bestiary_entry_id": self.warhound.id}

        self.assertEqual(self.post_as(self.rival, url, body).status_code, 403)
        self.assertEqual(self.post_as(self.outsider, url, body).status_code, 404)
        self.assertEqual(self.post_as(self.player, url, {"bestiary_entry_id": 999999}).status_code, 404)
        self.assertEqual(self.post_as(self.owner, url, body).status_code, 201)  # the campaign owner holds every code
        self.assertEqual(self.post_as(self.player, url, body).status_code, 201)  # again: still one favourite
        self.assertEqual(WarbandBestiaryFavourite.objects.filter(warband=self.warband).count(), 1)
        self.assertEqual(self.delete_as(self.rival, f"{url}{self.warhound.id}/").status_code, 403)
        self.assertEqual(self.delete_as(self.player, f"{url}{self.warhound.id}/").status_code, 204)
        self.assertEqual(self.get_as(self.rival, url).json(), [])


class RestrictionRouteTests(CatalogueTestCase):
    """SEC-06's route is gone with the restrictions (the items rebuild): who may buy, hire or learn names warband
    types and groups."""

    def test_the_restrictions_route_is_gone(self):
        self.assertEqual(self.get_as(self.player, "/api/restrictions/").status_code, 404)


class ItemRuleCreateTests(CatalogueTestCase):
    def test_a_players_new_shared_rule_is_saved_in_the_campaign(self):
        # BUG-145 (was pinned: saved as a book property every campaign listed; flipped in PR A)
        body = {"campaign_id": self.campaign.id, "name": "Cleave", "summary": "Hits twice.", "text": "Hits twice."}

        response = self.post_as(self.player, "/api/item-rules/", body)

        self.assertEqual((response.status_code, response.data["campaign_id"]), (201, self.campaign.id))
        shards = self.get_as(self.rival, f"/api/item-rules/?campaign_id={self.campaign.id}").json()
        elsewhere = self.get_as(self.outsider, f"/api/item-rules/?campaign_id={self.elsewhere.id}").json()
        self.assertIn("Cleave", [row["name"] for row in shards])
        self.assertNotIn("Cleave", [row["name"] for row in elsewhere])
        self.assertNotIn("Cleave", [row["name"] for row in self.get_as(self.outsider, "/api/item-rules/").json()])


class RaceWriteTests(CatalogueTestCase):
    def test_an_edit_cannot_move_a_race_to_another_campaign_or_into_the_book(self):
        # BUG-147 (was pinned: the edit dropped `campaign_id` but kept `campaign`, a writable field, so a race could be
        # moved anywhere; flipped in PR A: the campaign is no input, and an edit leaves it alone)
        moved = make_entry(RACES, "Halfling", campaign=self.campaign)
        booked = make_entry(RACES, "Gnome", campaign=self.campaign)

        to_elsewhere = self.patch_as(self.owner, RACES.detail_url(moved.id), {"campaign": self.elsewhere.id})
        to_book = self.patch_as(self.owner, RACES.detail_url(booked.id), {"campaign": None, "name": "Deep Gnome"})

        self.assertEqual((to_elsewhere.status_code, to_elsewhere.data["campaign_id"]), (200, self.campaign.id))
        self.assertEqual((to_book.status_code, to_book.data["campaign_id"], to_book.data["name"]), (200, self.campaign.id, "Deep Gnome"))  # fmt: skip
        self.assertNotIn("Deep Gnome", [row["name"] for row in self.get_as(self.outsider, RACES.list_url()).json()])
        self.assertEqual(Race.objects.get(id=moved.id).campaign_id, self.campaign.id)

    def test_a_race_is_created_in_the_campaign_named_by_campaign_id(self):
        response = self.post_as(self.player, RACES.list_url(), {**RACES.body("Elf", self.campaign), "campaign": self.elsewhere.id})  # fmt: skip

        self.assertEqual((response.status_code, response.data["campaign_id"]), (201, self.campaign.id))


class BestiaryWriteTests(CatalogueTestCase):
    def test_an_entry_is_created_with_its_links_and_an_edit_replaces_only_the_lists_it_sends(self):
        sprint = Skill.objects.get(name="Sprint")
        body = {
            "skill_ids": [self.infiltration[0].id, self.infiltration[0].id],
            "special_ids": [self.large.id],
            "item_entries": [self.book_axe.id, {"item_id": self.book_sword.id, "quantity": 2}],
        }

        created = self.create_as(self.owner, BESTIARY, "Bear", **body)
        url = BESTIARY.detail_url(created.data["id"])
        edited = self.patch_as(self.owner, url, {"skill_ids": [sprint.id], "large": True})

        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual([row["name"] for row in created.data["skills"]], ["Infiltration"])  # a repeated id once
        self.assertEqual(
            [(row["item"]["name"], row["quantity"]) for row in created.data["equipment"]], [("Axe", 1), ("Sword", 2)]
        )
        self.assertEqual([row["name"] for row in edited.data["skills"]], ["Sprint"])
        self.assertEqual(([row["name"] for row in edited.data["specials"]], edited.data["large"]), (["Large"], True))

    def test_a_hired_sword_is_created_with_the_grade_race_and_skill_types_it_was_sent(self):
        # BUG-53, CAT-UX-02 (was pinned: create dropped them; flipped in PR A); an edit changes them too. The race is
        # the catalogue's (`race_id`), and its label the text the source gave
        sent = {"grade": "1b", "race_id": self.human.id, "race_label": "Human", "available_skill_types": ["Combat"]}
        response = self.create_as(self.owner, HIRED_SWORDS, "Duellist", **sent)
        edited = self.patch_as(self.owner, HIRED_SWORDS.detail_url(response.data["id"]), {"grade": "2a", "race_id": None, "race_label": "Elf"})  # fmt: skip

        self.assertEqual(response.status_code, 201, response.data)
        body = response.data
        self.assertEqual((body["grade"], body["race_id"], body["race_name"], body["race_label"]), ("1b", self.human.id, "Human", "Human"))  # fmt: skip
        self.assertEqual((body["available_skill_types"], body["campaign_id"]), (["Combat"], self.campaign.id))
        self.assertEqual((body["hire_fee"]["gold"], body["upkeep_fee"]["gold"], body["rating"]), (30, 15, 12))
        self.assertEqual((edited.data["grade"], edited.data["race_id"], edited.data["race_label"]), ("2a", None, "Elf"))

    def test_a_hired_sword_edit_with_a_bad_field_saves_nothing(self):
        # BUG-53 (was pinned: the costs were saved, then the bad name was a 400; flipped in PR A)
        archer = make_entry(HIRED_SWORDS, "Archer", campaign=self.campaign)

        response = self.patch_as(self.owner, HIRED_SWORDS.detail_url(archer.id), {"hire_fee": {"gold": 99}, "name": ""})

        self.assertEqual((response.status_code, list(response.data)), (400, ["name"]))
        self.assertEqual(HiredSword.objects.get(id=archer.id).hire_fee["gold"], 40)

    def test_a_hired_sword_edit_with_a_cost_that_is_not_a_whole_number_of_0_or_more_is_a_400(self):
        # BUG-53 (was pinned: "abc" was a 500; flipped in PR A: the PATCH validates its costs)
        archer = make_entry(HIRED_SWORDS, "Archer", campaign=self.campaign)
        cases = [("hire_fee", {"gold": "abc"}), ("upkeep_fee", {"gold": -1}), ("rating", 1.5), ("hire_fee", {"note": "x" * 501})]  # fmt: skip
        cases += [("upkeep_fee", "70 gc"), ("hire_fee", {"kind": "free"}), ("upkeep_fee", {"dice_multiplier": 2})]
        for field, value in cases:
            with self.subTest(field=field, value=value):
                response = self.patch_as(self.owner, HIRED_SWORDS.detail_url(archer.id), {field: value})
                self.assertEqual((response.status_code, list(response.data)), (400, [field]))
        cleared = self.patch_as(
            self.owner, HIRED_SWORDS.detail_url(archer.id), {"hire_fee": {}, "upkeep_fee": {"gold": 0}}
        )
        self.assertEqual((cleared.data["hire_fee"], cleared.data["upkeep_fee"]["gold"]), (make_fee(), 0))

    def test_deleting_a_hired_sword_deletes_it_with_its_links(self):
        archer = make_entry(HIRED_SWORDS, "Archer", campaign=self.campaign)
        archer.skill_links.create(skill=self.infiltration[0])

        self.assertEqual(self.delete_as(self.owner, HIRED_SWORDS.detail_url(archer.id)).status_code, 204)

        self.assertFalse(HiredSword.objects.filter(id=archer.id).exists())
        self.assertFalse(archer.skill_links.model.objects.filter(hired_sword_id=archer.id).exists())
