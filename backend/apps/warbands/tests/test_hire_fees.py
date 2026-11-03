"""Hiring with each kind of fee (the fees and skill lists step): what `POST warbands/<id>/hirelings/hire/` pays.

The gold sent is what is charged, else the fee's gold plus the dice roll sent; each resource line is paid from the
counter sent (null: not paid), else from the counter of its name ("Wyrdstone shards" pays Wyrdstone), never below 0,
and noted on the Hire ledger row. A short counter, or none, warns; a fee in his rules hires at what is set with a
warning; one who takes a hero's place counts towards the heroes' cap, warns when it is full and may let a hero go in
the same request. A hand-typed hire (`custom`) pays the same way and keeps the fees it was given.
"""

from typing import Any

from apps.hirelings.fees import fee_payload, make_fee
from apps.hirelings.models import DramatisPersona, HiredSword
from apps.warbands.models import Hero, Hireling, Warband, WarbandResource, WarbandTrade

from .roster_support import HERO, HIRELING, create_payload, make_unit, unit_url
from .test_roster_hire import STATS, HireTestCase


def codes(response: Any) -> list[str]:
    return [warning["code"] for warning in response.data["warnings"]]


def trade_rows(warband: Warband) -> list[tuple[str, str, int, str]]:
    """(action, description, price, notes) for every ledger row, oldest first."""
    rows = WarbandTrade.objects.filter(warband=warband).order_by("id")
    return [(row.action, row.description, row.price, row.notes) for row in rows]


class GoldAndDiceTests(HireTestCase):
    def test_the_gold_sent_is_what_is_charged(self):
        response = self.hire(price=65)

        self.assertEqual((response.status_code, response.data["price"]), (201, 65))
        self.assertEqual(trade_rows(self.warband), [("Hire", "Ogre Bodyguard", -65, "")])
        self.assertEqual(response.data["hire_fee"]["gold"], 80)  # the fee he was hired for stays the catalogue's

    def test_a_dice_fee_adds_the_roll_sent_and_warns_when_none_was(self):
        HiredSword.objects.filter(id=self.ogre.id).update(hire_fee=make_fee(gold=70, dice=3))

        rolled = self.hire(dice_roll=11)
        unrolled = self.hire()

        self.assertEqual((rolled.data["price"], codes(rolled)), (81, []))
        self.assertEqual((unrolled.data["price"], codes(unrolled)), (70, ["fee_not_rolled"]))

    def test_a_dice_fee_with_a_multiplier(self):
        HiredSword.objects.filter(id=self.ogre.id).update(hire_fee=make_fee(gold=200, dice=1, dice_multiplier=25))

        self.assertEqual(self.hire(dice_roll=4).data["price"], 300)


class ResourceTests(HireTestCase):
    def setUp(self) -> None:
        super().setUp()
        fee = make_fee(gold=20, resources=[("Treasure", 2), ("Wyrdstone", 1)])
        HiredSword.objects.filter(id=self.ogre.id).update(hire_fee=fee)
        self.treasure = WarbandResource.objects.create(warband=self.warband, name="Treasures", amount=3)
        self.shards = WarbandResource.objects.create(warband=self.warband, name="Wyrdstone shards", amount=5)

    def amounts(self) -> tuple[int, int]:
        self.treasure.refresh_from_db()
        self.shards.refresh_from_db()
        return self.treasure.amount, self.shards.amount

    def test_each_line_is_paid_from_the_counter_of_its_name_and_noted_on_the_hire(self):
        response = self.hire(name="Pete")

        self.assertEqual((response.status_code, codes(response)), (201, []))
        self.assertEqual(self.amounts(), (1, 4))
        self.assertEqual(
            trade_rows(self.warband),
            [
                (
                    "Hire",
                    "Pete the Ogre Bodyguard",
                    -20,
                    "Paid 2 Treasure from Treasures, 1 Wyrdstone from Wyrdstone shards.",
                )
            ],  # fmt: skip
        )

    def test_wyrdstone_is_paid_from_the_default_resource_whatever_the_campaign_calls_it(self):
        default = WarbandResource.objects.create(warband=self.warband, name="Warpstone", amount=2, is_default=True)

        response = self.hire(name="Pete")

        default.refresh_from_db()
        self.assertEqual((default.amount, self.amounts(), codes(response)), (1, (1, 5), []))  # the shards untouched
        notes = "Paid 2 Treasure from Treasures, 1 Wyrdstone from Warpstone."
        self.assertEqual(trade_rows(self.warband), [("Hire", "Pete the Ogre Bodyguard", -20, notes)])

    def test_a_short_counter_pays_what_it_holds_and_never_goes_below_0(self):
        self.treasure.amount = 1
        self.treasure.save()

        response = self.hire()

        self.assertEqual(self.amounts(), (0, 4))
        self.assertEqual(codes(response), ["resource_short"])
        self.assertIn("1 of 2 Treasure from Treasures", trade_rows(self.warband)[0][3])

    def test_a_line_no_counter_pays_warns_and_is_noted_unpaid(self):
        self.treasure.delete()

        response = self.hire()

        self.assertEqual(codes(response), ["resource_unpaid"])
        self.assertEqual(
            trade_rows(self.warband)[0][3], "Paid 1 Wyrdstone from Wyrdstone shards. Not paid: 2 Treasure."
        )

    def test_the_player_picks_the_counter_edits_the_amount_or_doesnt_pay_a_line(self):
        gold = WarbandResource.objects.create(warband=self.warband, name="Gromril", amount=4)
        lines = [
            {"resource": "Treasure", "amount": 3, "resource_id": gold.id},  # another counter, and more than asked
            {"resource": "Wyrdstone", "amount": 1, "resource_id": None},  # "Don't pay this"
        ]

        response = self.hire(price=0, resources=lines)

        gold.refresh_from_db()
        self.assertEqual((gold.amount, self.amounts(), codes(response)), (1, (3, 5), []))
        self.assertEqual(trade_rows(self.warband), [("Hire", "Ogre Bodyguard", 0, "Paid 3 Treasure from Gromril. Not paid: 1 Wyrdstone.")])  # fmt: skip

    def test_another_warbands_counter_pays_nothing(self):
        theirs = WarbandResource.objects.create(warband=self.rival, name="Treasure", amount=9)

        response = self.hire(resources=[{"resource": "Treasure", "amount": 2, "resource_id": theirs.id}])

        theirs.refresh_from_db()
        self.assertEqual((theirs.amount, codes(response)), (9, ["resource_unpaid"]))


class FeeKindTests(HireTestCase):
    def test_a_fee_in_his_rules_hires_at_what_is_set_with_a_warning(self):
        truthsayer = DramatisPersona.objects.create(name="Truthsayer", hire_fee=make_fee("special"), **STATS)

        free = self.hire("dramatis_persona", truthsayer.id)
        paid = self.hire("dramatis_persona", truthsayer.id, price=40)

        self.assertEqual((free.status_code, free.data["price"], codes(free)), (201, 0, ["fee_special"]))
        self.assertEqual(paid.data["price"], 40)
        self.assertEqual([row[2] for row in trade_rows(self.warband)], [-40])  # nothing for the free one

    def test_one_in_a_heros_place_is_free_and_counts_as_a_hero_not_a_hired_sword(self):
        priest = HiredSword.objects.create(name="Priest of Morr", hire_fee=make_fee("replaces_hero"), **STATS)
        self.campaign_settings.max_hired_swords = 1
        self.campaign_settings.max_heroes = 2
        self.campaign_settings.save()
        make_unit(HIRELING, self.warband)  # the hired-sword cap is full
        make_unit(HERO, self.warband)

        hired = self.hire(entry_id=priest.id)

        self.assertEqual((hired.status_code, hired.data["price"], codes(hired)), (201, 0, []))
        self.assertEqual(trade_rows(self.warband), [])
        summary = self.client.get(f"/api/warbands/{self.warband.id}/summary/").json()
        self.assertEqual((summary["hero_count"], summary["hireling_count"]), (2, 1))
        refused = self.client.post(unit_url(HERO, self.warband.id), create_payload(HERO), format="json")
        self.assertEqual((refused.status_code, refused.json()["code"]), (400, "hero_cap_reached"))

    def test_at_the_heroes_cap_he_warns_and_may_let_a_hero_go(self):
        priest = HiredSword.objects.create(name="Priest of Morr", hire_fee=make_fee("replaces_hero"), **STATS)
        self.campaign_settings.max_heroes = 1
        self.campaign_settings.save()
        hero = make_unit(HERO, self.warband)

        warned = self.hire(entry_id=priest.id)
        Hireling.objects.filter(id=warned.data["id"]).delete()
        made_room = self.hire(entry_id=priest.id, dismiss_hero_id=hero.id)
        refused = self.hire(entry_id=priest.id, dismiss_hero_id=hero.id)  # he has gone

        self.assertEqual((warned.status_code, codes(warned)), (201, ["hero_place_taken"]))
        self.assertEqual((made_room.status_code, codes(made_room)), (201, []))
        self.assertIsNotNone(Hero.objects.get(id=hero.id).dismissed_at)
        self.assertEqual((refused.status_code, list(refused.json())), (400, ["dismiss_hero_id"]))

    def test_a_fee_of_none_hires_for_nothing(self):
        HiredSword.objects.filter(id=self.ogre.id).update(hire_fee=make_fee("none"))

        response = self.hire()

        self.assertEqual((response.data["price"], codes(response), trade_rows(self.warband)), (0, [], []))


class CustomHireTests(HireTestCase):
    def test_a_hand_typed_hire_pays_and_keeps_the_fees_it_was_given(self):
        WarbandResource.objects.create(warband=self.warband, name="Wyrdstone", amount=2)
        upkeep = make_fee(gold=10, resources=[("Wyrdstone", 1)])
        body = {"name": "Hans", "unit_type": "Duellist", "price": 35, "upkeep_fee": upkeep}
        body["resources"] = [{"resource": "Wyrdstone", "amount": 1, "resource_id": None}]

        response = self.client.post(unit_url(HIRELING, self.warband.id, suffix="hire/"), {"source": "custom", **body}, format="json")  # fmt: skip

        self.assertEqual(response.status_code, 201, response.data)
        data = response.data
        self.assertEqual((data["name"], data["unit_type"], data["kind"], data["price"]), ("Hans", "Duellist", "hired_sword", 35))  # fmt: skip
        self.assertEqual(data["hire_fee"], fee_payload(make_fee(gold=35, resources=[("Wyrdstone", 1)])))
        self.assertEqual(data["upkeep_fee"], fee_payload(upkeep))
        self.assertEqual(trade_rows(self.warband), [("Hire", "Hans the Duellist", -35, "Not paid: 1 Wyrdstone.")])

    def test_a_line_sent_without_its_counter_is_paid_by_the_counter_of_its_name(self):
        # what the browser check found: a hand-typed hire's line has no names of its own, so the server matches it
        shards = WarbandResource.objects.create(warband=self.warband, name="Wyrdstone shards", amount=2)
        body = {"source": "custom", "name": "Hans", "price": 0, "resources": [{"resource": "Wyrdstone", "amount": 1}]}

        response = self.client.post(unit_url(HIRELING, self.warband.id, suffix="hire/"), body, format="json")

        shards.refresh_from_db()
        self.assertEqual((response.status_code, shards.amount), (201, 1))
        self.assertEqual(trade_rows(self.warband)[0][3], "Paid 1 Wyrdstone from Wyrdstone shards.")

    def test_a_catalogue_hire_names_its_entry(self):
        response = self.client.post(unit_url(HIRELING, self.warband.id, suffix="hire/"), {"source": "hired_sword"}, format="json")  # fmt: skip

        self.assertEqual((response.status_code, list(response.json()["fields"])), (400, ["id"]))
