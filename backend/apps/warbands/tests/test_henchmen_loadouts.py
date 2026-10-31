"""Henchmen loadouts (the items plan's "one loadout per group", step 12): a group's item rows are what every member
carries, one copy each, and a gap records a member who lacks one.

One test class per row of the plan's table, on the warband's side: buying for a group, a new member joining, Lad's
Got Talent, unequipping to the stash, taking one member's kit, dismissing a member, selling, and rating and value;
plus a gap filled or left. The battle's rows (a henchman dying, a horse dying, in battle) are in
apps/battles/tests/test_battle_henchmen_loadouts.py.
"""

from decimal import Decimal
from typing import Any

from apps.warbands.models import Henchman, HenchmanItemGap, HenchmenGroupItem, Hero, LedgerAction, WarbandItem
from apps.warbands.services import ledger

from .beast_support import warhorse
from .roster_support import HENCHMEN, ItemMoveHelpers, RosterTestCase, make_unit, trade_rows, unit_url


class LoadoutTestCase(ItemMoveHelpers, RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        ledger.record(self.warband, LedgerAction.REWARD, 500, "Purse")
        self.group = make_unit(HENCHMEN, self.warband, name="Clanrats", price=25, members=("Skritt", "Queek", "Snikch"))
        self.skritt, self.queek, self.snikch = self.group.henchmen.order_by("id")

    def row(self, item: Any, cost: int | None = 10, **fields: Any) -> HenchmenGroupItem:
        return HenchmenGroupItem.objects.create(henchmen_group=self.group, item=item, cost=cost, **fields)

    def gap(self, member: Henchman, row: HenchmenGroupItem, reason: str = HenchmanItemGap.LOST) -> HenchmanItemGap:
        return HenchmanItemGap.objects.create(henchman=member, group_item=row, reason=reason)

    def rows(self) -> list[tuple[int, int | None]]:
        return list(self.group.henchmen_group_items.order_by("id").values_list("item_id", "cost"))

    def gaps(self) -> list[tuple[str, str, str]]:
        found = HenchmanItemGap.objects.filter(group_item__henchmen_group=self.group).order_by("id")
        return [(gap.henchman.name, gap.group_item.item.name, gap.reason) for gap in found]

    def stash(self) -> list[tuple[str, int | None, int]]:
        found = WarbandItem.objects.filter(warband=self.warband).order_by("item__name", "cost")
        return [(row.item.name, row.cost, row.quantity) for row in found]

    def group_payload(self) -> dict[str, Any]:
        response = self.client.get(unit_url(HENCHMEN, self.warband.id, self.group.id))
        self.assertEqual(response.status_code, 200, response.data)
        return dict(response.data)

    def post(self, path: str, body: dict[str, Any] | None = None, status: int = 200) -> Any:
        response = self.client.post(f"/api/warbands/{self.warband.id}/{path}", body or {}, format="json")
        self.assertEqual(response.status_code, status, getattr(response, "data", response.content))
        return response.data

    def patch_members(self, members: list[dict[str, Any]], status: int = 200) -> Any:
        url = unit_url(HENCHMEN, self.warband.id, self.group.id)
        response = self.client.patch(url, {"henchmen": members}, format="json")
        self.assertEqual(response.status_code, status, response.data)
        return response.data


class BuyingForAGroupTests(LoadoutTestCase):
    def test_a_purchase_for_a_group_is_one_row_charged_for_each_living_member(self):
        body = self.post("purchases/", {"item_id": self.sword.id, "quantity": 1, "target_type": "henchmen_group", "target_id": self.group.id}, 201)  # fmt: skip

        self.assertEqual(self.rows(), [(self.sword.id, 10)])
        self.assertEqual(body["trade"]["price"], -30)  # a sword each: 3 x 10 gc
        self.assertEqual((body["unit"]["loadout_each"], body["unit"]["loadout_total"]), (10, 30))
        self.assertEqual([item["carriers"] for item in body["unit"]["items"]], [3])
        self.assertEqual(body["unit"]["hire_cost"], 35)  # a recruit buys the loadout too

    def test_a_roster_save_buys_for_a_new_group_once_its_members_exist(self):
        create = {"name": "Thugs", "unit_type": "Thug", "price": 20, "henchmen": [{"name": "A"}, {"name": "B"}]}
        purchase = {"create_index": 0, "item_id": self.sword.id, "quantity": 1, "price": 10}

        body = self.post("henchmen-groups/batch/", {"create": [create], "purchases": [purchase]})

        thugs = next(unit for unit in body["units"] if unit["name"] == "Thugs")
        self.assertEqual([(item["name"], item["carriers"]) for item in thugs["items"]], [("Sword", 2)])
        self.assertIn(("Buy", "Sword x 2", -20, None), trade_rows(self.warband))


class NewMemberTests(LoadoutTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.sword_row, self.axe_row = self.row(self.sword, 10), self.row(self.axe, 5)
        WarbandItem.objects.create(warband=self.warband, item=self.axe, cost=5, quantity=1)

    def test_the_recruit_price_includes_the_loadout(self):
        self.patch_members([{"id": member.id} for member in (self.skritt, self.queek, self.snikch)] + [{"name": "Tik"}])

        self.assertEqual(trade_rows(self.warband)[-1], ("Recruit", "Tik into Clanrats", -40, None))  # 25 + 10 + 5

    def test_a_row_from_the_stash_costs_nothing_and_one_he_joins_without_is_a_gap(self):
        members = [{"id": member.id} for member in (self.skritt, self.queek, self.snikch)]
        tik = {"name": "Tik", "from_stash": [self.axe_row.id], "without": [self.sword_row.id]}

        self.patch_members([*members, tik])

        self.assertEqual(trade_rows(self.warband)[-1], ("Recruit", "Tik into Clanrats", -25, None))
        self.assertEqual(self.stash(), [])  # the stash's axe went to him
        self.assertEqual(self.gaps(), [("Tik", "Sword", HenchmanItemGap.SHORT)])
        self.assertEqual(self.rows(), [(self.sword.id, 10), (self.axe.id, 5)])  # the loadout is unchanged

    def test_a_row_the_stash_lacks_refuses_the_save(self):
        WarbandItem.objects.all().delete()
        members = [{"id": member.id} for member in (self.skritt, self.queek, self.snikch)]

        data = self.patch_members([*members, {"name": "Tik", "from_stash": [self.axe_row.id]}], status=400)

        self.assertEqual(data["code"], "not_enough_in_stash")
        self.assertFalse(Henchman.objects.filter(name="Tik").exists())


class LadsGotTalentTests(LoadoutTestCase):
    def test_he_takes_one_of_each_row_less_his_gaps_and_the_loadout_stays(self):
        self.row(self.sword)
        axe_row = self.row(self.axe, 5)
        self.gap(self.skritt, axe_row)
        self.group.level_up = 1
        self.group.save(update_fields=["level_up"])

        body = self.post(f"henchmen-groups/{self.group.id}/promote/", {"henchman_id": self.skritt.id, "advance": "WS"}, 201)  # fmt: skip

        hero = Hero.objects.get(pk=body["hero"]["id"])
        self.assertEqual(list(hero.hero_items.values_list("item__name", "cost")), [("Sword", 10)])
        self.assertEqual(self.rows(), [(self.sword.id, 10), (self.axe.id, 5)])
        self.assertEqual([item["carriers"] for item in body["group"]["items"]], [2, 2])


class UnequipTests(LoadoutTestCase):
    def test_one_copy_per_living_member_less_gaps_goes_to_the_stash_and_the_row_goes(self):
        sword_row = self.row(self.sword, 12)
        self.gap(self.queek, sword_row)

        response = self._transfer(item_id=self.sword.id, quantity=1, source_type="henchmen_group", source_id=self.group.id, target_type="stash")  # fmt: skip

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.stash(), [("Sword", 12, 2)])
        self.assertEqual((self.rows(), self.gaps()), ([], []))

    def test_copies_from_the_stash_arm_the_oldest_members_and_the_rest_get_gaps(self):
        WarbandItem.objects.create(warband=self.warband, item=self.sword, cost=10, quantity=2)

        response = self._transfer(item_id=self.sword.id, quantity=2, source_type="stash", target_type="henchmen_group", target_id=self.group.id)  # fmt: skip

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.rows(), [(self.sword.id, 10)])
        self.assertEqual(self.gaps(), [("Snikch", "Sword", HenchmanItemGap.SHORT)])
        self.assertEqual(self.stash(), [])


class TakeKitTests(LoadoutTestCase):
    def test_his_kit_goes_to_the_stash_at_its_cost_and_he_gets_a_gap_for_each(self):
        self.row(self.sword, 10)
        axe_row = self.row(self.axe, 5)
        self.gap(self.skritt, axe_row)

        body = self.post(f"henchmen-groups/{self.group.id}/members/{self.skritt.id}/take-kit/")

        self.assertEqual(self.stash(), [("Sword", 10, 1)])
        self.assertEqual(self.gaps(), [("Skritt", "Axe", "lost"), ("Skritt", "Sword", HenchmanItemGap.KIT_TAKEN)])
        self.assertEqual([entry["name"] for entry in body["stash_items"]], ["Sword"])
        [skritt] = [member for member in body["unit"]["henchmen"] if member["id"] == self.skritt.id]
        self.assertEqual([gap["reason"] for gap in skritt["gaps"]], ["lost", "kit_taken"])
        self.assertEqual(body["unit"]["loadout_total"], 10 * 2 + 5 * 2)

    def test_a_member_who_carries_nothing_is_refused(self):
        body = self.post(f"henchmen-groups/{self.group.id}/members/{self.skritt.id}/take-kit/", status=400)

        self.assertEqual(body["code"], "nothing_carried")


class DismissTests(LoadoutTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.sword_row, self.axe_row = self.row(self.sword, 10), self.row(self.axe, 5)
        self.gap(self.skritt, self.axe_row)

    def kept(self) -> list[dict[str, Any]]:
        return [{"id": self.queek.id}, {"id": self.snikch.id}]

    def test_his_share_less_his_gaps_can_go_to_the_stash(self):
        self.patch_members([*self.kept(), {"id": self.skritt.id, "dismiss": "stash"}])

        self.assertEqual(self.stash(), [("Sword", 10, 1)])
        self.assertIsNotNone(Henchman.objects.get(pk=self.skritt.pk).dismissed_at)
        self.assertEqual(self.rows(), [(self.sword.id, 10), (self.axe.id, 5)])

    def test_or_he_leaves_with_it_as_when_he_is_left_out(self):
        self.patch_members([*self.kept(), {"id": self.skritt.id, "dismiss": "leaves"}])
        self.patch_members([{"id": self.snikch.id}])  # Queek left out

        self.assertEqual(self.stash(), [])
        self.assertEqual(list(self.group.henchmen.filter(dismissed_at__isnull=True)), [self.snikch])


class SellingTests(LoadoutTestCase):
    def test_a_sale_sells_the_row_for_each_member_who_carries_it(self):
        sword_row = self.row(self.sword, 10)
        self.gap(self.skritt, sword_row)
        url = f"/api/warbands/{self.warband.id}/item-sales/"

        response = self.client.post(url, {"item_id": self.sword.id, "quantity": 1, "source_type": "henchmen_group", "source_id": self.group.id}, format="json")  # fmt: skip

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(trade_rows(self.warband)[-1], ("Sell", "Sword x 2", 10, None))  # half of 10, twice
        self.assertEqual(self.rows(), [])


class GapActionTests(LoadoutTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.horse = warhorse()
        self.horse_row = self.row(self.horse, 80, companion=True)
        self.lost = self.gap(self.skritt, self.horse_row)

    def act(self, status: int = 200, **body: Any) -> Any:
        return self.post(f"henchmen-groups/{self.group.id}/gaps/{self.lost.id}/", body, status)

    def test_buy_one_charges_one_copy_and_fills_the_gap(self):
        body = self.act(action="buy")

        self.assertEqual(trade_rows(self.warband)[-1], ("Buy", "Warhorse for Skritt", -80, None))
        self.assertEqual(self.gaps(), [])
        self.assertEqual([item["carriers"] for item in body["unit"]["items"]], [3])

    def test_take_from_stash_moves_one_copy(self):
        WarbandItem.objects.create(warband=self.warband, item=self.horse, cost=70, quantity=2)

        body = self.act(action="stash")

        self.assertEqual(self.stash(), [("Warhorse", 70, 1)])
        self.assertEqual(body["stash_items"][0]["quantity"], 1)
        self.assertEqual(self.gaps(), [])

    def test_an_empty_stash_refuses(self):
        self.assertEqual(self.act(status=400, action="stash")["code"], "not_enough_in_stash")

    def test_leave_it_keeps_the_gap_marked_left(self):
        self.act(action="leave")

        self.assertTrue(HenchmanItemGap.objects.get(pk=self.lost.pk).left)

    def test_another_groups_gap_is_not_found(self):
        other = make_unit(HENCHMEN, self.warband, name="Others")
        url = f"henchmen-groups/{other.id}/gaps/{self.lost.id}/"

        self.post(url, {"action": "leave"}, status=404)


class RatingAndValueTests(LoadoutTestCase):
    def test_the_mount_rating_and_the_loadout_total_count_members_less_gaps(self):
        horse_row = self.row(warhorse(), 80, companion=True)
        self.row(self.sword, 10)
        self.gap(self.skritt, horse_row)
        self.group.xp = Decimal("0")
        self.group.save(update_fields=["xp"])

        payload = self.group_payload()
        summary = self.client.get(f"/api/warbands/{self.warband.id}/summary/").json()

        self.assertEqual((payload["loadout_each"], payload["loadout_total"]), (90, 80 * 2 + 10 * 3))
        self.assertEqual(summary["mounts_rating"], 10)  # two riders at 5
        self.assertEqual(summary["rating"], 3 * 5 + 10)
        sheet = self.client.get(f"/api/warbands/{self.warband.id}/sheet/").json()
        self.assertEqual(sheet["summary"]["mounts_rating"], 10)

    def test_switching_the_groups_mount_rides_every_member_who_carries_it(self):
        horse_row = self.row(warhorse(), 80)
        url = unit_url(HENCHMEN, self.warband.id, self.group.id, f"items/{horse_row.id}/companion/")

        response = self.client.post(url, {"on": True}, format="json")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["unit"]["mount"]["name"], "Warhorse")
        self.assertEqual(response.data["summary"]["mounts_rating"], 15)
