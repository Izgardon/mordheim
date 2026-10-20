"""Characterisation: what catalogue writes store and accept today (pass 5; BUG-53, SEC-06, SEC-07, BUG-80, BUG-145).

Item writes take availabilities as a raw list of dicts and property ids as a raw list; bestiary and hired-sword
writes take skill, special, spell, item and restriction ids. None of these ids is checked against the campaign
(SEC-07's catalogue half, CAT-TEST-16). Writes that fail part-way are in `test_catalogue_transactions.py`.
"""

import logging
from typing import Any
from unittest import mock

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

    def test_unknown_property_and_restriction_ids_are_dropped_silently(self):
        availabilities = [{"cost": 5, "rarity": 2, "restrictions": [{"restriction_id": 999999}]}]

        response = self.create_as(self.owner, ITEMS, "Club", availabilities=availabilities, property_ids=[999999])

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual((response.data["properties"], response.data["availabilities"][0]["restrictions"]), ([], []))

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

    def test_linking_an_animal_through_bestiary_entry_id_is_a_500(self):
        # Characterises current behaviour (BUG-146, pinned; flips in PR A): ItemCreateSerializer passes the raw id to
        # the `bestiary_entry` relation, which needs an instance, so the write raises ValueError after nothing is saved
        self.client.raise_request_exception = False
        self._quiet_request_errors()

        response = self.create_as(self.owner, ITEMS, "Pony", type="Animal", bestiary_entry_id=self.warhound.id)

        self.assertEqual(response.status_code, 500)
        self.assertFalse(Item.objects.filter(name="Pony").exists())

    def _quiet_request_errors(self) -> None:
        logger = logging.getLogger("django.request")
        self.addCleanup(setattr, logger, "disabled", logger.disabled)
        logger.disabled = True


class CampaignScopeOfWriteIdsTests(CatalogueTestCase):
    """SEC-07's catalogue half (CAT-TEST-16): ids from another campaign are linked, and their text then reads back."""

    def test_an_item_links_another_campaigns_property_and_restriction(self):
        # Characterises current behaviour (SEC-07, pinned; flips in PR A: scoped PrimaryKeyRelatedFields, a 400)
        their_property = ItemProperty.objects.create(name="Secret rule", type="Weapon", campaign=self.elsewhere)
        their_restriction = Restriction.objects.create(restriction="Their warband", campaign=self.elsewhere)
        availabilities = [{"cost": 5, "rarity": 2, "restrictions": [{"restriction_id": their_restriction.id}]}]

        response = self.create_as(self.player, ITEMS, "Spy glass", availabilities=availabilities, property_ids=[their_property.id])  # fmt: skip

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual([prop["name"] for prop in response.data["properties"]], ["Secret rule"])
        self.assertEqual(response.data["availabilities"][0]["restrictions"][0]["restriction"]["restriction"], "Their warband")  # fmt: skip

    def test_a_bestiary_entry_links_another_campaigns_skills_specials_spells_and_items(self):
        # Characterises current behaviour (SEC-07, CAT-TEST-16, pinned; flips in PR A)
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
        detail = self.get_as(self.player, BESTIARY.detail_url(created.data["id"])).json()

        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual([row["description"] for row in detail["skills"]], ["Secret"])
        self.assertEqual(
            ([row["name"] for row in detail["specials"]], [row["name"] for row in detail["spells"]]),
            (["Their special"], ["Their spell"]),
        )
        self.assertEqual([(row["item"]["name"], row["quantity"]) for row in detail["equipment"]], [("Their blade", 2)])

    def test_a_hired_sword_links_another_campaigns_restriction(self):
        # Characterises current behaviour (SEC-07, pinned; flips in PR A)
        theirs = Restriction.objects.create(restriction="Their warband", campaign=self.elsewhere)

        response = self.create_as(self.owner, HIRED_SWORDS, "Mole", restriction_ids=[{"restriction_id": theirs.id, "additional_note": "x"}])  # fmt: skip

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(
            response.data["restrictions"],
            [
                {
                    "restriction": {"id": theirs.id, "type": "Warband", "restriction": "Their warband"},
                    "additional_note": "x",
                }
            ],  # fmt: skip
        )

    def test_a_warband_favourites_another_campaigns_bestiary_entry_and_reads_it(self):
        # Characterises current behaviour (SEC-07, pinned; flips in PR A)
        theirs = make_entry(BESTIARY, "Their beast", campaign=self.elsewhere, description="Secret stats")
        url = f"/api/warbands/{self.warband.id}/bestiary-favourites/"

        added = self.post_as(self.player, url, {"bestiary_entry_id": theirs.id})
        listed = self.get_as(self.player, url).json()

        self.assertEqual(added.status_code, 201)
        self.assertEqual([(row["name"], row["description"]) for row in listed], [("Their beast", "Secret stats")])

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
    """SEC-06 (CAT-TEST-05): any signed-in user adds a global restriction, which every campaign then lists."""

    def test_anyone_signed_in_adds_a_global_restriction_that_every_campaign_lists(self):
        # Characterises current behaviour (SEC-06, pinned; flips in PR A: the POST is removed)
        response = self.post_as(self.outsider, "/api/restrictions/", {"type": "Warband", "restriction": "Junk"})

        self.assertEqual((response.status_code, response.data["campaign"]), (201, None))
        shards = self.get_as(self.player, f"/api/restrictions/?campaign_id={self.campaign.id}").json()
        self.assertIn("Junk", [row["restriction"] for row in shards])

    def test_the_same_global_text_can_be_added_again_and_again(self):
        # Characterises current behaviour (SEC-06, pinned; flips in PR A: nulls_distinct=False on the constraint)
        body = {"type": "Warband", "restriction": "Mercenaries"}

        statuses = [self.post_as(self.outsider, "/api/restrictions/", body).status_code for _ in range(2)]

        self.assertEqual(statuses, [201, 201])
        self.assertEqual(Restriction.objects.filter(restriction="Mercenaries", campaign__isnull=True).count(), 3)

    def test_settings_are_refused_and_signing_in_is_required(self):
        setting = self.post_as(self.outsider, "/api/restrictions/", {"type": "Setting", "restriction": "Lustria"})
        self.client.force_authenticate(user=None)
        anonymous = self.client.post("/api/restrictions/", {"type": "Warband", "restriction": "Junk"}, format="json")

        self.assertEqual((setting.status_code, list(setting.data)), (400, ["type"]))
        self.assertEqual(anonymous.status_code, 401)


class ItemPropertyCreateTests(CatalogueTestCase):
    def test_a_players_new_property_is_saved_as_a_book_property_every_campaign_lists(self):
        # Characterises current behaviour (BUG-145, pinned; flips in PR A): the view sets data["campaign"], which the
        # serializer has no field for, so the property is saved with no campaign
        body = {"campaign_id": self.campaign.id, "name": "Cleave", "type": "Weapon", "description": "Hits twice."}

        response = self.post_as(self.player, "/api/item-properties/", body)

        self.assertEqual((response.status_code, response.data["campaign_id"]), (201, None))
        elsewhere = self.get_as(self.outsider, f"/api/item-properties/?campaign_id={self.elsewhere.id}").json()
        self.assertIn("Cleave", [row["name"] for row in elsewhere])
        self.assertIn("Cleave", [row["name"] for row in self.get_as(self.outsider, "/api/item-properties/").json()])


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

    def test_a_hired_sword_is_created_without_the_grade_and_race_it_was_sent(self):
        # Characterises current behaviour (BUG-53, CAT-UX-02, pinned; flips in PR A: create keeps grade and race)
        response = self.create_as(self.owner, HIRED_SWORDS, "Duellist", grade="1b", race="Human", available_skill_types=["Combat"])  # fmt: skip

        self.assertEqual(response.status_code, 201, response.data)
        body = response.data
        self.assertEqual((body["grade"], body["race"], body["available_skill_types"]), ("", "", ["Combat"]))
        self.assertEqual((body["hire_cost"], body["upkeep_cost"], body["rating"]), (30, 15, 12))
        self.assertEqual((body["bestiary_entry"]["type"], body["campaign_id"]), ("Hired Sword", self.campaign.id))

    def test_a_hired_sword_edit_saves_its_costs_before_the_entry_is_validated(self):
        # Characterises current behaviour (BUG-53, pinned; flips in PR A): the costs are saved, then a bad name is a 400
        profile = make_entry(HIRED_SWORDS, "Archer", campaign=self.campaign)

        response = self.patch_as(self.owner, HIRED_SWORDS.detail_url(profile.id), {"hire_cost": 99, "name": ""})

        self.assertEqual((response.status_code, list(response.data)), (400, ["name"]))
        self.assertEqual(HiredSwordProfile.objects.get(id=profile.id).hire_cost, 99)

    def test_a_hired_sword_edit_with_a_cost_that_is_not_a_number_is_a_500(self):
        # Characterises current behaviour (BUG-53, pinned; flips in PR A: a 400)
        profile = make_entry(HIRED_SWORDS, "Archer", campaign=self.campaign)
        self.client.raise_request_exception = False
        logger = logging.getLogger("django.request")
        self.addCleanup(setattr, logger, "disabled", logger.disabled)
        logger.disabled = True

        response = self.patch_as(self.owner, HIRED_SWORDS.detail_url(profile.id), {"hire_cost": "abc"})

        self.assertEqual(response.status_code, 500)

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
