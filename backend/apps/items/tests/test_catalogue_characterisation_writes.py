"""What catalogue writes store and accept (pass 5; BUG-53, BUG-145, BUG-146, BUG-147, SEC-06, SEC-07, BUG-80).

Item writes take availabilities as nested input and property ids; bestiary and hired-sword writes take skill,
special, spell, item and restriction ids. Since PR A every id must be the book's or the writer's campaign's (SEC-07's
catalogue half, CAT-TEST-16): another campaign's id is refused like an unknown one. Writes that fail part-way are
in `test_catalogue_transactions.py`.
"""

from typing import Any
from unittest import mock

from django.db import IntegrityError, transaction
from django.test import override_settings

from apps.bestiary.models import BestiaryEntry, HiredSwordProfile, WarbandBestiaryFavourite
from apps.items.models import Item, ItemAvailability, ItemProperty
from apps.races.models import Race
from apps.restrictions.models import Restriction
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell

from .catalogue_support import BESTIARY, HIRED_SWORDS, ITEMS, KINDS, RACES, CatalogueTestCase, make_entry


class ItemWriteTests(CatalogueTestCase):
    def test_an_item_is_created_with_its_availabilities_restrictions_and_properties(self):
        availabilities = [
            {
                "cost": 30,
                "rarity": 9,
                "restrictions": [{"restriction_id": self.mercenaries.id, "additional_note": "Heroes"}],
            },  # fmt: skip
            {"variable_cost": "+2D6"},
        ]

        response = self.create_as(self.player, ITEMS, "Halberd", availabilities=availabilities, property_ids=[self.parry.id])  # fmt: skip

        self.assertEqual(response.status_code, 201, response.data)
        body = response.data
        self.assertEqual((body["strength"], body["range"], body["save"]), ("As user", "Close combat", None))
        self.assertEqual([prop["name"] for prop in body["properties"]], ["Parry"])
        # a missing cost is 0 and a missing rarity is 2; availabilities are listed cheapest first
        self.assertEqual(
            [(row["cost"], row["rarity"], row["variable_cost"]) for row in body["availabilities"]],
            [(0, 2, "+2D6"), (30, 9, None)],
        )
        self.assertEqual(
            body["availabilities"][1]["restrictions"],
            [
                {
                    "restriction": {"id": self.mercenaries.id, "type": "Warband", "restriction": "Mercenaries"},
                    "additional_note": "Heroes",
                }
            ],  # fmt: skip
        )

    def test_unknown_property_and_restriction_ids_are_refused(self):
        # SEC-07 (they used to be dropped silently): an unknown id and another campaign's read the same, a 400
        availabilities = [{"cost": 5, "rarity": 2, "restrictions": [{"restriction_id": 999999}]}]

        response = self.create_as(self.owner, ITEMS, "Club", availabilities=availabilities, property_ids=[999999])

        unknown = ['Invalid pk "999999" - object does not exist.']
        self.assertEqual((response.status_code, response.json()), (400, {"property_ids": unknown, "availabilities": unknown}))  # fmt: skip
        self.assertFalse(Item.objects.filter(name="Club").exists())

    def test_an_edit_replaces_the_availabilities_and_properties_it_sends_and_keeps_the_rest(self):
        item = make_entry(ITEMS, "Flail", campaign=self.campaign, cost=15)
        original = item.availabilities.get().id
        url = ITEMS.detail_url(item.id)

        renamed = self.patch_as(self.owner, url, {"name": "Morning Star"})
        repriced = self.patch_as(self.owner, url, {"availabilities": [{"cost": 20, "rarity": 3}], "property_ids": [self.parry.id]})  # fmt: skip

        self.assertEqual(renamed.data["availabilities"][0]["id"], original)
        [availability] = repriced.data["availabilities"]
        # the old row is deleted and a new one written (ids churn, CAT-BUG-08)
        self.assertNotEqual(availability["id"], original)
        self.assertEqual((availability["cost"], availability["rarity"]), (20, 3))
        self.assertEqual([prop["name"] for prop in repriced.data["properties"]], ["Parry"])
        self.assertFalse(ItemAvailability.objects.filter(id=original).exists())

    def test_an_item_can_be_moved_to_no_campaign_by_neither_create_nor_edit(self):
        created = self.post_as(self.owner, ITEMS.list_url(), {**ITEMS.body("Pike", self.campaign), "campaign": None})
        edited = self.patch_as(
            self.owner, ITEMS.detail_url(created.data["id"]), {"campaign": None, "campaign_id": None}
        )

        self.assertEqual(
            (created.data["campaign_id"], edited.data["campaign_id"]), (self.campaign.id, self.campaign.id)
        )

    def test_an_item_links_its_animal_through_bestiary_entry_id(self):
        # BUG-146 (was pinned: the raw id reached the relation, which needs an instance, so every write was a 500;
        # flipped in PR A: a scoped related field)
        theirs = make_entry(BESTIARY, "Their pony", campaign=self.elsewhere)

        created = self.create_as(self.owner, ITEMS, "Hound", type="Animal", bestiary_entry_id=self.warhound.id)
        unlinked = self.patch_as(self.owner, ITEMS.detail_url(created.data["id"]), {"bestiary_entry_id": None})
        foreign = self.create_as(self.owner, ITEMS, "Pony", type="Animal", bestiary_entry_id=theirs.id)

        self.assertEqual((created.status_code, created.data["bestiary_entry"]["name"]), (201, "Warhound"))
        self.assertEqual((unlinked.status_code, unlinked.data["bestiary_entry"]), (200, None))
        self.assertEqual((foreign.status_code, list(foreign.data)), (400, ["bestiary_entry_id"]))
        self.assertFalse(Item.objects.filter(name="Pony").exists())


class CampaignScopeOfWriteIdsTests(CatalogueTestCase):
    """SEC-07's catalogue half (CAT-TEST-16): ids from another campaign are linked, and their text then reads back."""

    def test_an_item_cannot_link_another_campaigns_property_or_restriction(self):
        # SEC-07 (was pinned: both were linked and their text read back; flipped in PR A: scoped ids, a 400 that
        # reads like an unknown id, and nothing written); the book's and this campaign's are linked
        their_property = ItemProperty.objects.create(name="Secret rule", type="Weapon", campaign=self.elsewhere)
        their_restriction = Restriction.objects.create(restriction="Their warband", campaign=self.elsewhere)
        our_property = ItemProperty.objects.create(name="House rule", type="Weapon", campaign=self.campaign)
        availabilities = [{"cost": 5, "rarity": 2, "restrictions": [{"restriction_id": their_restriction.id}]}]

        refused = self.create_as(self.player, ITEMS, "Spy glass", availabilities=availabilities, property_ids=[their_property.id])  # fmt: skip
        linked = self.create_as(self.player, ITEMS, "Telescope", property_ids=[our_property.id, self.parry.id])

        self.assertEqual((refused.status_code, sorted(refused.data)), (400, ["availabilities", "property_ids"]))
        self.assertEqual(refused.data["property_ids"], [f'Invalid pk "{their_property.id}" - object does not exist.'])
        self.assertFalse(Item.objects.filter(name="Spy glass").exists())
        self.assertEqual([prop["name"] for prop in linked.data["properties"]], ["House rule", "Parry"])

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

    def test_a_hired_sword_cannot_link_another_campaigns_restriction(self):
        # SEC-07 (was pinned: linked, and its text read back; flipped in PR A)
        theirs = Restriction.objects.create(restriction="Their warband", campaign=self.elsewhere)

        response = self.create_as(self.owner, HIRED_SWORDS, "Mole", restriction_ids=[{"restriction_id": theirs.id, "additional_note": "x"}])  # fmt: skip

        self.assertEqual(response.json(), {"restriction_ids": [f'Invalid pk "{theirs.id}" - object does not exist.']})
        self.assertFalse(BestiaryEntry.objects.filter(name="Mole").exists())

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


class RestrictionCreateTests(CatalogueTestCase):
    """SEC-06 (CAT-TEST-05): restrictions are the seeders' rows; nothing adds one through the API."""

    def test_nobody_adds_a_global_restriction_through_the_api(self):
        # SEC-06 (was pinned: any signed-in user added a global row that every campaign listed; flipped in PR A)
        for user in (self.outsider, self.owner):
            with self.subTest(user=user.first_name):
                response = self.post_as(user, "/api/restrictions/", {"type": "Warband", "restriction": "Junk"})
                self.assertEqual(response.status_code, 405)
        self.assertFalse(Restriction.objects.filter(restriction="Junk").exists())
        shards = self.get_as(self.player, f"/api/restrictions/?campaign_id={self.campaign.id}").json()
        self.assertEqual([row["restriction"] for row in shards], ["Mercenaries"])

    def test_the_book_holds_one_row_per_text_and_type(self):
        # SEC-06 (was pinned: the same global text could be added again and again; flipped in PR A by
        # nulls_distinct=False): another type of the same text, or a campaign's row, is still a row of its own
        Restriction.objects.create(type="Warband Group", restriction="Mercenaries")
        Restriction.objects.create(type="Warband", restriction="Mercenaries", campaign=self.campaign)

        with self.assertRaises(IntegrityError), transaction.atomic():
            Restriction.objects.create(type="Warband", restriction="Mercenaries")
        self.assertEqual(Restriction.objects.filter(restriction="Mercenaries").count(), 3)

    def test_signing_in_is_still_required_to_read_them(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/restrictions/").status_code, 401)
        self.assertEqual(
            self.client.post("/api/restrictions/", {"restriction": "Junk"}, format="json").status_code, 401
        )


class ItemPropertyCreateTests(CatalogueTestCase):
    def test_a_players_new_property_is_saved_in_the_campaign(self):
        # BUG-145 (was pinned: saved as a book property every campaign listed; flipped in PR A)
        body = {"campaign_id": self.campaign.id, "name": "Cleave", "type": "Weapon", "description": "Hits twice."}

        response = self.post_as(self.player, "/api/item-properties/", body)

        self.assertEqual((response.status_code, response.data["campaign_id"]), (201, self.campaign.id))
        shards = self.get_as(self.rival, f"/api/item-properties/?campaign_id={self.campaign.id}").json()
        elsewhere = self.get_as(self.outsider, f"/api/item-properties/?campaign_id={self.elsewhere.id}").json()
        self.assertIn("Cleave", [row["name"] for row in shards])
        self.assertNotIn("Cleave", [row["name"] for row in elsewhere])
        self.assertNotIn("Cleave", [row["name"] for row in self.get_as(self.outsider, "/api/item-properties/").json()])


class RaceWriteTests(CatalogueTestCase):
    def test_an_edit_can_move_a_race_to_another_campaign_or_into_the_book(self):
        # Characterises current behaviour (BUG-147, pinned; flips in PR A): the race edit drops `campaign_id` but
        # keeps `campaign`, a writable field of RaceCreateSerializer
        moved = make_entry(RACES, "Halfling", campaign=self.campaign)
        booked = make_entry(RACES, "Gnome", campaign=self.campaign)

        to_elsewhere = self.patch_as(self.owner, RACES.detail_url(moved.id), {"campaign": self.elsewhere.id})
        to_book = self.patch_as(self.owner, RACES.detail_url(booked.id), {"campaign": None})

        self.assertEqual((to_elsewhere.status_code, to_elsewhere.data["campaign_id"]), (200, self.elsewhere.id))
        self.assertEqual((to_book.status_code, to_book.data["campaign_id"]), (200, None))
        self.assertIn("Gnome", [row["name"] for row in self.get_as(self.outsider, RACES.list_url()).json()])
        self.assertEqual(Race.objects.get(id=moved.id).campaign_id, self.elsewhere.id)

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

    def test_a_hired_sword_is_created_with_the_grade_and_race_it_was_sent(self):
        # BUG-53, CAT-UX-02 (was pinned: create dropped them; flipped in PR A); an edit changes them too
        response = self.create_as(self.owner, HIRED_SWORDS, "Duellist", grade="1b", race="Human", available_skill_types=["Combat"])  # fmt: skip
        edited = self.patch_as(self.owner, HIRED_SWORDS.detail_url(response.data["id"]), {"grade": "2a", "race": "Elf"})

        self.assertEqual(response.status_code, 201, response.data)
        body = response.data
        self.assertEqual((body["grade"], body["race"], body["available_skill_types"]), ("1b", "Human", ["Combat"]))
        self.assertEqual((body["hire_cost"], body["upkeep_cost"], body["rating"]), (30, 15, 12))
        self.assertEqual((body["bestiary_entry"]["type"], body["campaign_id"]), ("Hired Sword", self.campaign.id))
        self.assertEqual((edited.data["grade"], edited.data["race"]), ("2a", "Elf"))

    def test_a_hired_sword_edit_with_a_bad_field_saves_nothing(self):
        # BUG-53 (was pinned: the costs were saved, then the bad name was a 400; flipped in PR A)
        profile = make_entry(HIRED_SWORDS, "Archer", campaign=self.campaign)

        response = self.patch_as(self.owner, HIRED_SWORDS.detail_url(profile.id), {"hire_cost": 99, "name": ""})

        self.assertEqual((response.status_code, list(response.data)), (400, ["name"]))
        self.assertEqual(HiredSwordProfile.objects.get(id=profile.id).hire_cost, 40)

    def test_a_hired_sword_edit_with_a_cost_that_is_not_a_whole_number_of_0_or_more_is_a_400(self):
        # BUG-53 (was pinned: "abc" was a 500; flipped in PR A: the PATCH validates its costs)
        profile = make_entry(HIRED_SWORDS, "Archer", campaign=self.campaign)
        cases = [("hire_cost", "abc"), ("upkeep_cost", -1), ("rating", 1.5), ("hire_cost_expression", "x" * 121)]
        for field, value in cases:
            with self.subTest(field=field, value=value):
                response = self.patch_as(self.owner, HIRED_SWORDS.detail_url(profile.id), {field: value})
                self.assertEqual((response.status_code, list(response.data)), (400, [field]))
        cleared = self.patch_as(self.owner, HIRED_SWORDS.detail_url(profile.id), {"hire_cost": None, "upkeep_cost": 0})
        self.assertEqual((cleared.data["hire_cost"], cleared.data["upkeep_cost"]), (None, 0))

    def test_deleting_a_hired_sword_deletes_its_entry(self):
        profile = make_entry(HIRED_SWORDS, "Archer", campaign=self.campaign)

        self.assertEqual(self.delete_as(self.owner, HIRED_SWORDS.detail_url(profile.id)).status_code, 204)

        self.assertFalse(BestiaryEntry.objects.filter(id=profile.bestiary_entry_id).exists())


@override_settings(EXTERNAL_DISPATCH_SYNC=True)
class CatalogueRealtimeTests(CatalogueTestCase):
    def test_catalogue_writes_tell_no_other_member(self):
        # Characterises current behaviour (BUG-80, pinned; flips in PR C: catalogue.changed on the events channel)
        pusher = mock.Mock()
        patcher = mock.patch("apps.realtime.services.get_pusher_client", return_value=pusher)
        patcher.start()
        self.addCleanup(patcher.stop)

        def send(method: str, url: str, body: dict[str, Any] | None = None) -> Any:
            self.client.force_authenticate(user=self.owner)
            with self.captureOnCommitCallbacks(execute=True):
                return getattr(self.client, method)(url, body or {}, format="json")

        for kind in KINDS:
            with self.subTest(kind=kind.key):
                created = send("post", kind.list_url(), kind.body(f"Live {kind.key}", self.campaign))
                url = kind.detail_url(created.data["id"])
                statuses = [created.status_code, send("patch", url, {"name": "Changed"}).status_code]
                if kind.deletable:
                    statuses.append(send("delete", url).status_code)
                self.assertEqual(statuses, [201, 200, 204] if kind.deletable else [201, 200])
        self.assertEqual(pusher.trigger.call_args_list, [])
