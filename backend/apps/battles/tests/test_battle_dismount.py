"""A rider can get off his mount for the rest of the battle (the bestiary rewrite step 5).

`POST unit-dismount/ {"unit_key", "dismounted"}` marks one of the player's selected riders Dismounted in an active
battle, or back on his mount. It is stored in his unit information (`dismounted: true`, left out when false), seen by
the other players through the battle's broadcast, and kept by config saves, out-of-action taps and kills, which
never undo it. Only a rider (a unit whose battle roster has a mount) dismounts, and not while out of action, so the
state he was taken out of action in is the one postbattle reads. What he shows on foot is his roster entry's
`footStats`: his save less the step riding the mount is worth, which his stored save holds.
"""

from typing import Any

from apps.battles.models import BattleKill
from apps.warbands.models import HenchmanItemGap, HenchmenGroupItem, Hero, HeroItem
from apps.warbands.tests.beast_support import cold_one, warhorse
from apps.warbands.tests.roster_support import HENCHMEN, HERO, make_unit, unit_url

from .battle_support import BattleTestCase, status_changed


class DismountTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.horse = warhorse()
        self.aldric = Hero.objects.create(warband=self.warband, name="Aldric", unit_type="Captain", movement=4)
        HeroItem.objects.create(hero=self.aldric, item=self.horse, companion=True)
        self.walker = Hero.objects.create(warband=self.warband, name="Walker", unit_type="Youngblood")
        self.riders = make_unit(HENCHMEN, self.warband, name="Outriders", members=("A", "B"))
        row = HenchmenGroupItem.objects.create(henchmen_group=self.riders, item=self.horse, companion=True)
        HenchmanItemGap.objects.create(henchman=self.riders.henchmen.order_by("id").last(), group_item=row)  # no horse
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
        self.assertEqual((entry["dismounted"], entry["out_of_action"]), (True, True))
        self.assertEqual(BattleKill.objects.filter(battle_id=battle_id, killer_hero_id=self.aldric.id).count(), 1)

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


class DismountSaveTests(BattleTestCase):
    """Getting off the mount takes the step riding it was worth off what the battle shows (William, 18 Nov 2026:
    "this should take 1 away and add one when mounted, not when owned like items"). The rider's entry carries both
    numbers, his ridden one in `stats` (the stored save, which has the step) and his foot one in `footStats`;
    nothing is written to the unit, and the warband's own payload still shows what he holds."""

    def setUp(self) -> None:
        super().setUp()
        self.horse = warhorse()
        self.riders = {}
        for name, save in (("Aldric", 5), ("Ragged", 6), ("Bare", None)):
            hero = Hero.objects.create(warband=self.warband, name=name, unit_type="Knight", armour_save=save)
            HeroItem.objects.create(hero=hero, item=self.horse, companion=True)  # riding it, so his save has the step
            self.riders[name] = hero
        self.walker = Hero.objects.create(warband=self.warband, name="Walker", unit_type="Youngblood", armour_save=5)
        self.group = make_unit(HENCHMEN, self.warband, name="Outriders", members=("A",), armour_save=5)
        HenchmenGroupItem.objects.create(henchmen_group=self.group, item=self.horse, companion=True)
        self.rat = Hero.objects.create(warband=self.rival, name="Rat", unit_type="Assassin")

    def keys(self) -> list[str]:
        members = [f"henchman:{member.id}" for member in self.group.henchmen.all()]
        return [f"hero:{hero.id}" for hero in (*self.riders.values(), self.walker)] + members

    def mine(self, battle_id: int) -> dict:
        roster = self.ok(self.get_as(self.player, self.url(battle_id, "rosters"))).data[str(self.player.id)]
        members = [member for group in roster["henchmenGroups"] for member in group["members"]]
        return {entry["displayName"]: entry for entry in [*roster["heroes"], *members]}

    def test_a_rider_shows_a_save_a_step_worse_on_foot_and_the_one_he_holds_in_the_saddle(self):
        battle_id = self.to_prebattle()

        shown = self.mine(battle_id)

        foot = {name: entry["footStats"] for name, entry in shown.items()}
        self.assertEqual(foot["Aldric"], {"armour_save": 6})  # 5+ in the saddle, 6+ on his feet
        self.assertEqual(foot["Ragged"], {"armour_save": None})  # 6+ leaves him with none
        self.assertEqual(foot["Bare"], {"armour_save": None})  # none stays none
        self.assertEqual(foot["A"], {"armour_save": 6})  # the group's save, one worse for the member who gets off
        self.assertIsNone(foot["Walker"])  # no mount, nothing to get off
        saddle = {name: entry["stats"]["armour_save"] for name, entry in shown.items()}
        self.assertEqual(saddle, {"Aldric": 5, "Ragged": 6, "Bare": None, "Walker": 5, "A": 5})
        self.assertEqual(shown["Aldric"]["effectiveStats"], {"movement": 8})

    def test_a_rider_on_a_two_step_mount_shows_a_save_two_steps_worse_on_foot(self):
        """A mount's steps are its beast's (William, 18 Nov 2026), so getting off a Cold One takes two back."""
        scaly = Hero.objects.create(warband=self.warband, name="Scaly", unit_type="Knight", armour_save=4)
        HeroItem.objects.create(hero=scaly, item=cold_one(), companion=True)  # riding it, so his 4+ has both steps
        battle_id = self.to_prebattle()

        entry = self.mine(battle_id)["Scaly"]

        self.assertEqual((entry["stats"]["armour_save"], entry["footStats"]), (4, {"armour_save": 6}))

    def test_dismounting_and_mounting_again_writes_nothing_to_the_unit(self):
        battle_id = self.to_active({self.player: self.keys(), self.viewer: [f"hero:{self.rat.id}"]})
        aldric = f"hero:{self.riders['Aldric'].id}"
        body = {"unit_key": aldric, "dismounted": True}

        self.ok(self.post_as(self.player, self.url(battle_id, "unit-dismount"), body))
        self.ok(self.post_as(self.player, self.url(battle_id, "unit-dismount"), {**body, "dismounted": False}))

        self.riders["Aldric"].refresh_from_db()
        self.assertEqual(self.riders["Aldric"].armour_save, 5)  # the saddle's save, untouched throughout
        entry = self.mine(battle_id)["Aldric"]
        self.assertEqual((entry["stats"]["armour_save"], entry["footStats"]), (5, {"armour_save": 6}))

    def test_the_warbands_own_payload_shows_the_save_he_holds_and_no_foot_stats(self):
        unit = self.ok(self.get_as(self.player, unit_url(HERO, self.warband.id, self.riders["Aldric"].id))).data

        self.assertEqual((unit["armour_save"], unit["effective_stats"]), (5, {"movement": 8}))
        self.assertNotIn("foot_stats", unit)
        self.assertNotIn("footStats", unit)
