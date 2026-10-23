"""After a battle, a mount whose rider was taken out of action may die (the bestiary rewrite step 5).

Postbattle suggests a D6 for each selected rider who went out of action on his mount (not dismounted): it dies on
a 1 or 2, or only on a 1 when the rider carries Barding or a Farrier is on the warband's battle roster
(`suggested_postbattle.mount_survival`, left out when nobody rides at risk). Like an injury, the roll and its result are
the player's (`postbattle_json.mount_survival`: `{unit key: {roll, dead}}`), never automatic. At finalise a dead
mount's copy leaves the rider (his ridden copy first; a henchman who died already took his), with a log row; one that
survives stays. Finalise stays constant in units.
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.special.models import Special
from apps.warbands.models import HenchmenGroupItem, Hero, HeroItem, HirelingSpecial, WarbandLog
from apps.warbands.tests.beast_support import warhorse
from apps.warbands.tests.roster_support import HENCHMEN, make_unit

from .battle_support import BattleTestCase, catalogue_item, draft, unit_result


class MountSurvivalTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.horse = warhorse()
        self.aldric = self.rider("Aldric")
        self.outriders = make_unit(HENCHMEN, self.warband, name="Outriders", members=("A", "B"))
        for _ in range(2):
            HenchmenGroupItem.objects.create(henchmen_group=self.outriders, item=self.horse, companion=True)
        HenchmenGroupItem.objects.create(henchmen_group=self.outriders, item=self.horse)  # a spare
        self.rat = Hero.objects.create(warband=self.rival, name="Rat", unit_type="Assassin")
        self.a, self.r = f"hero:{self.aldric.id}", f"hero:{self.rat.id}"
        self.m1, self.m2 = (f"henchman:{member.id}" for member in self.outriders.henchmen.order_by("id"))

    def rider(self, name: str) -> Hero:
        hero = Hero.objects.create(warband=self.warband, name=name, unit_type="Knight")
        HeroItem.objects.create(hero=hero, item=self.horse, companion=True)
        return hero

    def fought(self, *keys: str, out: tuple[str, ...] = (), dismounted: tuple[str, ...] = ()) -> int:
        battle_id = self.to_active({self.player: list(keys), self.viewer: [self.r]})
        for key in dismounted:
            self.ok(self.post_as(self.player, self.url(battle_id, "unit-dismount"), {"unit_key": key, "dismounted": True}))  # fmt: skip
        for key in out:
            self.ok(self.post_as(self.player, self.url(battle_id, "unit-ooa"), {"unit_key": key, "out_of_action": True}), 201)  # fmt: skip
        self.finish(battle_id, [self.warband])
        return battle_id

    def suggested(self, battle_id: int) -> Any:
        state = self.ok(self.get_as(self.player, self.url(battle_id, "state") + "?view=postbattle")).data
        return state["suggested_postbattle"]

    def test_each_rider_taken_out_on_his_mount_is_suggested_a_roll_for_it(self):
        walker = Hero.objects.create(warband=self.warband, name="Walker", unit_type="Youngblood")
        keys = (self.a, self.m1, self.m2, f"hero:{walker.id}")
        battle_id = self.fought(*keys, out=(self.a, self.m2, f"hero:{walker.id}"), dismounted=(self.m2,))

        entries = self.suggested(battle_id)["mount_survival"]["entries"]

        self.assertEqual(entries, {self.a: {"unit_name": "Aldric", "mount": "Warhorse", "dies_on": 2}})

    def test_nobody_at_risk_leaves_the_suggestion_out(self):
        battle_id = self.fought(self.a, self.m1)

        self.assertNotIn("mount_survival", self.suggested(battle_id))

    def test_barding_or_a_farrier_makes_it_die_only_on_a_1(self):
        HeroItem.objects.create(hero=self.aldric, item=catalogue_item("Barding", 30))
        sword = self.warband.hirelings.create(name="Smith", unit_type="Swordsmith")
        HirelingSpecial.objects.create(hireling=sword, special=Special.objects.create(name="Farrier", type="Ability"))
        battle_id = self.fought(self.a, self.m1, out=(self.a, self.m1))

        entries = self.suggested(battle_id)["mount_survival"]["entries"]

        self.assertEqual((entries[self.a]["dies_on"], entries[self.a]["saved_by"]), (1, ["barding", "farrier"]))
        self.assertEqual((entries[self.m1]["dies_on"], entries[self.m1]["saved_by"]), (1, ["farrier"]))

    def results(self, *keys: str, dead: tuple[str, ...] = ()) -> dict[str, Any]:
        return {key: unit_result(key, dead=key in dead) for key in keys}

    def test_a_dead_mount_leaves_its_rider_with_a_log_row_and_a_survivor_stays(self):
        spare = HeroItem.objects.create(hero=self.aldric, item=self.horse)
        other = self.rider("Bertrand")
        b = f"hero:{other.id}"
        battle_id = self.fought(self.a, b, self.m1, self.m2, out=(self.a, b, self.m1))
        mounts = {self.a: {"roll": 2, "dead": True}, b: {"roll": 3, "dead": False}, self.m1: {"roll": 1, "dead": True}}

        self.ok(self.finalize(self.player, battle_id, draft(self.results(self.a, b, self.m1, self.m2), mount_survival=mounts)))  # fmt: skip

        self.assertEqual(list(HeroItem.objects.filter(hero=self.aldric).values_list("id", "companion")), [(spare.id, False)])  # fmt: skip
        self.assertTrue(HeroItem.objects.filter(hero=other, companion=True).exists())
        group_rows = HenchmenGroupItem.objects.filter(henchmen_group=self.outriders)
        self.assertEqual(sorted(group_rows.values_list("companion", flat=True)), [False, True])  # one ridden copy gone
        log = WarbandLog.objects.get(warband=self.warband, entry_type="mounts_lost")
        lost = [(entry["unit_name"], entry["mount"], entry["roll"]) for entry in log.payload["mounts"]]
        self.assertEqual(lost, [("Aldric", "Warhorse", 2), ("A", "Warhorse", 1)])  # as the battle named them

    def test_a_henchman_who_died_took_his_mount_already(self):
        battle_id = self.fought(self.m1, self.m2, out=(self.m1,))
        mounts = {self.m1: {"roll": 1, "dead": True}}

        self.ok(self.finalize(self.player, battle_id, draft(self.results(self.m1, self.m2, dead=(self.m1,)), mount_survival=mounts)))  # fmt: skip

        group_rows = HenchmenGroupItem.objects.filter(henchmen_group=self.outriders)
        self.assertEqual(sorted(group_rows.values_list("companion", flat=True)), [False, True])  # his share only

    def test_the_draft_keeps_the_rolls_and_refuses_a_bad_one(self):
        battle_id = self.fought(self.a, out=(self.a,))
        save = self.url(battle_id, "postbattle")

        bad = self.post_as(self.player, save, {"postbattle_json": draft(self.results(self.a), mount_survival={self.a: {"roll": 7, "dead": True}})})  # fmt: skip
        saved = self.ok(self.post_as(self.player, save, {"postbattle_json": draft(self.results(self.a), mount_survival={self.a: {"roll": None, "dead": False}})}))  # fmt: skip

        self.assertEqual(bad.status_code, 400)
        stored = self.participant(battle_id, self.player).postbattle_json
        self.assertEqual(stored["mount_survival"], {self.a: {"roll": None, "dead": False}})
        self.assertIsNotNone(saved.data)

    def test_finalise_costs_the_same_however_many_mounts_die(self):
        def finalise_losing(riders: list[Hero]) -> int:
            keys = [f"hero:{hero.id}" for hero in riders]
            battle_id = self.fought(*keys, out=tuple(keys))
            mounts = {key: {"roll": 1, "dead": True} for key in keys}
            self.client.force_authenticate(user=self.player)
            body = {"postbattle_json": draft(self.results(*keys), mount_survival=mounts)}
            with CaptureQueriesContext(connection) as captured:
                self.ok(self.client.post(self.url(battle_id, "finalize-postbattle"), body, format="json"))
            return len(captured)

        finalise_losing([self.rider("Warm-up")])  # the test's first finalise reads once what the others reuse
        few = finalise_losing([self.rider("One")])
        many = finalise_losing([self.rider(f"Rider {n}") for n in range(3)])

        self.assertEqual(many, few)
