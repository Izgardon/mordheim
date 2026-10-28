"""Buying beasts (the bestiary rewrite step 4): assign or recruit straight away, charged once as the item.

A purchase line for a unit may carry `companion: true` (a mount or pet: it lands switched on, with the companion
warnings); POST purchases/ may carry `recruit` (a creature: recruited into a new group or one of the same beast
instead of landing in the stash, with no RECRUIT row). A beast the shop doesn't sell is bought with `unlisted_beast`.
A hired sword's kit mount is switched on as its mount when it is hired.
"""

from typing import Any

from apps.hirelings.models import HiredSword
from apps.warbands.models import HenchmenGroup, HeroItem, HirelingItem, LedgerAction, WarbandItem
from apps.warbands.services import ledger

from .beast_support import beast, make_animal, raven, wardogs, warhorse
from .roster_support import HENCHMEN, HERO, HIRELING, RosterTestCase, log_rows, make_unit, trade_rows, unit_url


class BeastPurchaseTestCase(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.horse, self.raven, self.dogs = warhorse(), raven(), wardogs()
        self.hero = make_unit(HERO, self.warband, name="Aldric", movement=4, armour_save=5)
        ledger.record(self.warband, LedgerAction.REWARD, 500, "Purse")  # no gold_negative warning

    def buy(self, **body: Any) -> Any:
        return self.client.post(f"/api/warbands/{self.warband.id}/purchases/", body, format="json")


class AssignStraightAwayTests(BeastPurchaseTestCase):
    def test_a_mount_bought_for_a_unit_lands_ridden(self):
        response = self.buy(item_id=self.horse.id, target_type="hero", target_id=self.hero.id, companion=True)

        self.assertEqual(response.status_code, 201, response.data)
        body = response.data
        self.assertEqual((body["mount"]["name"], body["effective_stats"], body["pets"]), ("Warhorse", {"movement": 8, "armour_save": 4}, []))  # fmt: skip
        self.assertEqual([(item["companion"], item["beast_kind"]) for item in body["items"]], [(True, "mount")])
        self.assertEqual(body["warnings"], [])
        self.assertEqual(trade_rows(self.warband)[1:], [("Buy", "Warhorse", -80, None)])
        self.assertEqual(float(body["summary"]["rating"]), 5 + 5)

    def test_without_the_flag_it_lands_switched_off(self):
        body = self.buy(item_id=self.horse.id, target_type="hero", target_id=self.hero.id).data

        self.assertEqual((body["mount"], body["items"][0]["companion"]), (None, False))

    def test_a_second_mount_warns(self):
        HeroItem.objects.create(hero=self.hero, item=self.horse, companion=True)

        body = self.buy(item_id=self.horse.id, target_type="hero", target_id=self.hero.id, companion=True).data

        self.assertEqual([warning["code"] for warning in body["warnings"]], ["two_mounts"])

    def test_only_a_mount_or_a_pet_lands_switched_on_and_only_on_a_unit(self):
        for item in (self.dogs, self.sword):
            response = self.buy(item_id=item.id, target_type="hero", target_id=self.hero.id, companion=True)
            self.assertEqual((response.status_code, response.data["code"]), (400, "not_a_companion"), item.name)
        response = self.buy(item_id=self.raven.id, target_type="stash", companion=True)
        self.assertEqual((response.status_code, list(response.data["fields"])), (400, ["companion"]))
        self.assertEqual(len(trade_rows(self.warband)), 1)  # the purse alone

    def test_a_roster_save_buys_a_mount_switched_on(self):
        line = {"unit_id": self.hero.id, "item_id": self.horse.id, "companion": True}
        url = unit_url(HERO, self.warband.id, suffix="batch/")

        response = self.client.post(url, {"purchases": [line]}, format="json")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["units"][0]["mount"]["name"], "Warhorse")
        bad = self.client.post(url, {"purchases": [{**line, "item_id": self.dogs.id}]}, format="json")
        self.assertEqual((bad.status_code, list(bad.data["fields"])), (400, ["purchases.0.companion"]))


class RecruitStraightAwayTests(BeastPurchaseTestCase):
    def test_creatures_bought_are_recruited_into_a_new_group_and_charged_once(self):
        response = self.buy(item_id=self.dogs.id, quantity=2, price=33, target_type="stash", recruit={"new": {"name": "Kennel"}})  # fmt: skip

        self.assertEqual(response.status_code, 201, response.data)
        group = response.data["group"]
        self.assertEqual((group["name"], group["price"], len(group["henchmen"]), group["beast_kind"]), ("Kennel", 33, 2, "creature"))  # fmt: skip
        self.assertEqual((response.data["stash_item"], response.data["items"]), (None, None))
        self.assertFalse(WarbandItem.objects.filter(warband=self.warband).exists())
        self.assertEqual(trade_rows(self.warband)[1:], [("Buy", "Wardogs x 2", -66, None)])  # no RECRUIT row
        logs = [(row[0], row[1]) for row in log_rows(self.warband)]
        self.assertEqual(logs, [("loadout", "stash_item"), ("personnel", "new_henchmen_group"), ("items", "moved")])

    def test_creatures_bought_join_a_group_of_the_same_beast(self):
        group = make_unit(HENCHMEN, self.warband, members=("Rex",), price=25, source_beast=beast(self.dogs))

        body = self.buy(item_id=self.dogs.id, target_type="stash", recruit={"group_id": group.id}).data

        self.assertEqual((body["group"]["id"], len(body["group"]["henchmen"])), (group.id, 2))

    def test_recruiting_refuses_what_isnt_a_creature_another_beasts_group_and_a_unit_target(self):
        other = make_unit(HENCHMEN, self.warband)
        for body, code in (
            ({"item_id": self.horse.id, "target_type": "stash", "recruit": {"new": {}}}, "not_a_creature"),
            (
                {"item_id": self.dogs.id, "target_type": "stash", "recruit": {"group_id": other.id}},
                "not_the_same_beast",
            ),
            (
                {"item_id": self.dogs.id, "target_type": "hero", "target_id": self.hero.id, "recruit": {"new": {}}},
                "invalid",
            ),
        ):
            response = self.buy(**body)
            self.assertEqual((response.status_code, response.data["code"]), (400, code), body)
        self.assertEqual((len(trade_rows(self.warband)), HenchmenGroup.objects.filter(source_beast__isnull=False).exists()), (1, False))  # fmt: skip


class UnlistedBeastTests(BeastPurchaseTestCase):
    def test_a_beast_the_shop_doesnt_sell_is_bought_with_a_warning(self):
        wild = make_animal("Wild Dog", "creature", available_in_shop=False)

        response = self.buy(item_id=wild.id, price=10, target_type="stash")

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual([warning["code"] for warning in response.data["warnings"]], ["unlisted_beast"])
        self.assertEqual(response.data["stash_item"]["beast_kind"], "creature")


class HiredMountTests(RosterTestCase):
    def test_a_hired_swords_kit_mount_is_switched_on_as_its_mount(self):
        horse = warhorse()
        freelancer = HiredSword.objects.create(name="Freelancer", hire_cost=80, movement=4, armour_save=4)
        freelancer.item_links.create(item=horse)
        freelancer.item_links.create(item=self.sword)

        url = unit_url(HIRELING, self.warband.id, suffix="hire/")
        response = self.client.post(url, {"source": "hired_sword", "id": freelancer.id}, format="json")

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual((response.data["mount"]["name"], response.data["effective_stats"]), ("Warhorse", {"movement": 8, "armour_save": 3}))  # fmt: skip
        self.assertEqual(sorted(HirelingItem.objects.values_list("item__name", "companion")), [("Sword", False), ("Warhorse", True)])  # fmt: skip
        self.assertEqual(response.data["warnings"], [])


class BeastPurchaseReviewTests(BeastPurchaseTestCase):
    def test_a_purchase_recruits_errors_name_the_recruit_field_and_a_big_group_warns(self):
        bad = self.buy(item_id=self.dogs.id, target_type="stash", recruit={"new": {"race_id": self.foreign_race.id}})
        self.assertEqual((bad.status_code, list(bad.data["fields"])), (400, ["recruit.new.race"]))

        body = self.buy(item_id=self.dogs.id, quantity=6, target_type="stash", recruit={"new": {}}).data

        self.assertEqual([warning["code"] for warning in body["warnings"]], ["group_over_size"])

    def test_a_roster_save_warns_about_the_warbands_mounts_once_after_every_line(self):
        for name in ("Brother", "Cousin"):
            HeroItem.objects.create(hero=make_unit(HERO, self.warband, name=name), item=self.horse, companion=True)
        other = make_unit(HERO, self.warband, name="Uncle")
        lines = [{"unit_id": unit.id, "item_id": self.horse.id, "companion": True} for unit in (self.hero, other)]

        response = self.client.post(
            unit_url(HERO, self.warband.id, suffix="batch/"), {"purchases": lines}, format="json"
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            [(warning["code"], warning["mounts"]) for warning in response.data["warnings"]], [("warband_mounts", 4)]
        )
