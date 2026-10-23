"""A rider can get off his mount for the rest of the battle (the bestiary rewrite step 5).

`POST unit-dismount/ {"unit_key", "dismounted"}` marks one of the player's selected riders Dismounted in an active
battle, or back on his mount. It is stored in his unit information (`dismounted: true`, left out when false), seen by
the other players through the battle's broadcast, and kept by config saves, out-of-action taps and kills, which
never undo it. Only a rider (a unit whose battle roster has a mount) dismounts, and not while out of action, so the
state he was taken out of action in is the one postbattle reads.
"""

from typing import Any

from apps.warbands.models import HenchmenGroupItem, Hero, HeroItem
from apps.warbands.tests.beast_support import warhorse
from apps.warbands.tests.roster_support import HENCHMEN, make_unit

from .battle_support import BattleTestCase, status_changed


class DismountTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.horse = warhorse()
        self.aldric = Hero.objects.create(warband=self.warband, name="Aldric", unit_type="Captain", movement=4)
        HeroItem.objects.create(hero=self.aldric, item=self.horse, companion=True)
        self.walker = Hero.objects.create(warband=self.warband, name="Walker", unit_type="Youngblood")
        self.riders = make_unit(HENCHMEN, self.warband, name="Outriders", members=("A", "B"))
        HenchmenGroupItem.objects.create(henchmen_group=self.riders, item=self.horse, companion=True)
        self.rat = Hero.objects.create(warband=self.rival, name="Rat", unit_type="Assassin")
        self.a, self.w, self.r = f"hero:{self.aldric.id}", f"hero:{self.walker.id}", f"hero:{self.rat.id}"
        first, second = self.riders.henchmen.order_by("id")
        self.rider, self.on_foot = f"henchman:{first.id}", f"henchman:{second.id}"

    def active(self) -> int:
        return self.to_active({self.player: [self.a, self.w, self.rider, self.on_foot], self.viewer: [self.r]})

    def dismount(self, battle_id: int, unit_key: str, dismounted: Any = True, user: Any = None) -> Any:
        body = {"unit_key": unit_key, "dismounted": dismounted}
        return self.post_as(user or self.player, self.url(battle_id, "unit-dismount"), body)

    def info(self, battle_id: int) -> Any:
        return self.participant(battle_id, self.player).unit_information_json

    def test_a_rider_dismounts_for_the_rest_of_the_battle_and_the_others_see_it(self):
        battle_id = self.active()
        version = self.battle(battle_id).state_version

        response = self.ok(self.dismount(battle_id, self.a))

        self.assertTrue(self.info(battle_id)[self.a]["dismounted"])
        mine = next(entry for entry in response.data["participants"] if entry["user"]["id"] == self.player.id)
        self.assertTrue(mine["unit_information_json"][self.a]["dismounted"])
        self.assertEqual(self.battle(battle_id).state_version, version + 1)
        sent = self.battle_events.call_args_list[-1]
        self.assertEqual((sent.args[1], sent.args[2]["reason"]), ("battle_state_updated", "unit_dismounted"))
        [changed] = sent.kwargs["participants"]
        self.assertTrue(changed["unit_information_json"][self.a]["dismounted"])

    def test_he_can_mount_again_and_a_repeat_changes_nothing(self):
        battle_id = self.active()
        self.ok(self.dismount(battle_id, self.rider))
        sent = len(self.sent())

        self.ok(self.dismount(battle_id, self.rider))  # already dismounted
        self.assertEqual(len(self.sent()), sent)
        self.ok(self.dismount(battle_id, self.rider, False))

        self.assertNotIn(self.rider, self.info(battle_id))  # nothing left to say about him

    def test_config_saves_out_of_action_taps_and_kills_keep_it(self):
        battle_id = self.active()
        self.ok(self.dismount(battle_id, self.a))
        override = {"stats_override": {"movement": 5}}

        self.ok(self.post_as(self.player, self.url(battle_id, "config"), {"unit_information_patch": {self.a: override}}))  # fmt: skip
        self.ok(self.post_as(self.player, self.url(battle_id, "config"), {"unit_information_json": {}}))
        self.ok(self.kill(self.player, battle_id, self.a, self.r), 201)
        self.ok(self.post_as(self.player, self.url(battle_id, "unit-ooa"), {"unit_key": self.a, "out_of_action": True}), 201)  # fmt: skip

        entry = self.info(battle_id)[self.a]
        self.assertEqual((entry["dismounted"], entry["kill_count"], entry["out_of_action"]), (True, 1, True))

    def test_only_a_selected_rider_in_action_dismounts_in_an_active_battle(self):
        battle_id = self.to_prebattle()
        self.select(self.player, battle_id, [self.a])
        self.assertEqual(self.dismount(battle_id, self.a).data, status_changed("Battle is not active", "prebattle"))
        battle_id = self.active()
        self.ok(self.post_as(self.player, self.url(battle_id, "unit-ooa"), {"unit_key": self.a, "out_of_action": True}), 201)  # fmt: skip

        refusals = {
            "not selected": self.dismount(battle_id, f"hero:{self.aldric.id + 999}"),
            "on foot": self.dismount(battle_id, self.w),
            "a member without a mount": self.dismount(battle_id, self.on_foot),
            "out of action": self.dismount(battle_id, self.a),
            "someone else's": self.dismount(battle_id, self.r, user=self.player),
            "not a bool": self.dismount(battle_id, self.rider, "maybe"),
        }

        self.assertEqual({name: response.status_code for name, response in refusals.items()}, dict.fromkeys(refusals, 400))  # fmt: skip
        codes = {name: response.data.get("code") for name, response in refusals.items()}
        self.assertEqual((codes["on foot"], codes["a member without a mount"]), ("not_mounted", "not_mounted"))
        self.assertEqual(codes["out of action"], "out_of_action")
        self.assertFalse(self.info(battle_id).get(self.a, {}).get("dismounted"))
