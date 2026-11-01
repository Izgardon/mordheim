"""Henchmen loadouts in battle (the items plan's "one loadout per group", step 12): the battle's rows of the plan's
table. Each member shows his own gear (the group's rows less his gaps) and rides the group's mount unless he has a gap
on it; a member whose kit went to the stash is left out at first, with the reason. After the battle nothing of a
dead member's is deleted (the log lists what he carried), a rider whose horse died gets a gap on it, and a single-use
item a member used is a gap of his.
"""

from typing import Any

from apps.warbands.models import HenchmanItemGap, HenchmenGroupItem, Hero, WarbandLog
from apps.warbands.tests.beast_support import warhorse
from apps.warbands.tests.roster_support import HENCHMEN, make_unit

from .battle_support import BattleTestCase, catalogue_item, draft, unit_result


class BattleLoadoutTestCase(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.horse = warhorse()
        self.outriders = make_unit(HENCHMEN, self.warband, name="Outriders", members=("Skritt", "Queek"))
        self.skritt, self.queek = self.outriders.henchmen.order_by("id")
        self.horse_row = self.row(self.horse, companion=True)
        self.sword_row = self.row(self.sword)
        self.rat = Hero.objects.create(warband=self.rival, name="Rat", unit_type="Assassin")
        self.s, self.q, self.r = f"henchman:{self.skritt.id}", f"henchman:{self.queek.id}", f"hero:{self.rat.id}"

    def row(self, item: Any, **fields: Any) -> HenchmenGroupItem:
        return HenchmenGroupItem.objects.create(henchmen_group=self.outriders, item=item, cost=10, **fields)

    def gap(self, member: Any, row: HenchmenGroupItem, reason: str = HenchmanItemGap.LOST) -> HenchmanItemGap:
        return HenchmanItemGap.objects.create(henchman=member, group_item=row, reason=reason)

    def members(self) -> dict[str, dict[str, Any]]:
        battle_id = self.to_prebattle()
        rosters = self.ok(self.get_as(self.player, self.url(battle_id, "rosters"))).data
        [group] = rosters[str(self.player.id)]["henchmenGroups"]
        return {member["displayName"]: member for member in group["members"]}

    def results(self, *keys: str, dead: tuple[str, ...] = ()) -> dict[str, Any]:
        return {key: unit_result(key, dead=key in dead) for key in keys}

    def gaps(self) -> list[tuple[str, str, str]]:
        found = HenchmanItemGap.objects.filter(group_item__henchmen_group=self.outriders).order_by("id")
        return [(gap.henchman.name, gap.group_item.item.name, gap.reason) for gap in found]


class InBattleTests(BattleLoadoutTestCase):
    def test_a_member_without_a_name_is_called_by_his_type_and_number_not_his_row_id(self):
        # creature groups' members have no names: they read "Giant Rat 1", "Giant Rat 2", not "Henchman 6"
        self.outriders.unit_type = "Giant Rat"
        self.outriders.save(update_fields=["unit_type"])
        self.outriders.henchmen.update(name="")

        self.assertEqual(list(self.members()), ["Giant Rat 1", "Giant Rat 2"])

    def test_each_member_shows_his_own_gear_and_a_mount_gap_puts_him_on_foot(self):
        self.gap(self.skritt, self.horse_row)

        members = self.members()

        skritt, queek = members["Skritt"], members["Queek"]
        self.assertEqual([item["name"] for item in skritt["items"]], ["Sword"])
        self.assertEqual((skritt["mount"], skritt["effectiveStats"]), (None, None))
        self.assertEqual([gap["name"] for gap in skritt["gaps"]], ["Warhorse"])
        self.assertEqual([item["name"] for item in queek["items"]], ["Sword", "Warhorse"])
        self.assertEqual(queek["mount"]["name"], "Warhorse")
        self.assertIsNone(skritt["outReason"])

    def test_a_member_whose_kit_was_taken_is_left_out_with_the_reason(self):
        for row in (self.horse_row, self.sword_row):
            self.gap(self.skritt, row, HenchmanItemGap.KIT_TAKEN)

        skritt = self.members()["Skritt"]

        self.assertEqual(skritt["items"], [])
        self.assertIn("Warhorse, Sword", skritt["outReason"])

    def test_the_group_mounts_as_one_and_each_member_can_still_dismount(self):
        battle_id = self.to_active({self.player: [self.s, self.q], self.viewer: [self.r]})

        self.ok(self.post_as(self.player, self.url(battle_id, "unit-dismount"), {"unit_key": self.q, "dismounted": True}))  # fmt: skip

        info = self.participant(battle_id, self.player).unit_information_json
        self.assertTrue(info[self.q]["dismounted"])


class AfterTheBattleTests(BattleLoadoutTestCase):
    def test_a_henchman_who_dies_deletes_nothing_and_the_log_lists_what_he_carried(self):
        self.gap(self.skritt, self.sword_row)
        battle_id = self.to_postbattle({self.player: [self.s, self.q], self.viewer: [self.r]})

        self.ok(self.finalize(self.player, battle_id, draft(self.results(self.s, self.q, dead=(self.s,)))))

        self.assertEqual(HenchmenGroupItem.objects.filter(henchmen_group=self.outriders).count(), 2)
        log = WarbandLog.objects.filter(warband=self.warband, entry_type="items_lost").get()
        self.assertEqual(log.payload["units"], [{"unit_name": self.s, "items": ["Warhorse"]}])  # named by his key

    def test_a_rider_who_lives_but_whose_horse_dies_gets_a_gap_on_it(self):
        battle_id = self.to_active({self.player: [self.s, self.q], self.viewer: [self.r]})
        self.ok(self.post_as(self.player, self.url(battle_id, "unit-ooa"), {"unit_key": self.s, "out_of_action": True}), 201)  # fmt: skip
        self.finish(battle_id, [self.warband])
        mounts = {self.s: {"roll": 1, "dead": True}}

        self.ok(self.finalize(self.player, battle_id, draft(self.results(self.s, self.q), mount_survival=mounts)))

        self.assertEqual(self.gaps(), [("Skritt", "Warhorse", HenchmanItemGap.LOST)])
        self.assertTrue(HenchmenGroupItem.objects.filter(pk=self.horse_row.pk, companion=True).exists())

    def test_a_single_use_item_a_member_used_is_his_gap(self):
        potion = self.row(catalogue_item("Healing Herbs", 10, single_use=True))
        battle_id = self.to_active({self.player: [self.s, self.q], self.viewer: [self.r]})
        self.ok(self.use_item(self.player, battle_id, {"unit_key": self.q, "item_id": potion.item_id}), 201)
        self.finish(battle_id, [self.warband])

        self.ok(self.finalize(self.player, battle_id, draft(self.results(self.s, self.q))))

        self.assertEqual(self.gaps(), [("Queek", "Healing Herbs", HenchmanItemGap.USED)])
        self.assertTrue(HenchmenGroupItem.objects.filter(pk=potion.pk).exists())
