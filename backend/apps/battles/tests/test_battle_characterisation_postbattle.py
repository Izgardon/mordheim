"""Finalising postbattle characterised on the review's fixture warband (pass 3, step 0; BATL-TEST-07's fixture).

`warband` fields 5 heroes, 2 hired swords and 8 henchmen in 3 groups (each carrying a rope) against one rival
hero, and finds a lucky charm. Pinned: stat overrides made permanent without a log and unusual numbers accepted
silently (SEC-10, BUG-71); dead units keeping their items (pass 2 decision 7). A failed finalise writes nothing
(BUG-124, fixed; each trigger in test_battle_finalise_rollback.py).
"""

from decimal import Decimal
from typing import Any

from apps.warbands.models import (
    HenchmenGroupItem,
    HeroItem,
    HiredSwordItem,
    Warband,
    WarbandItem,
    WarbandResource,
)
from apps.warbands.tests.roster_support import log_rows, trade_rows

from .battle_support import BattleTestCase, build_fixture_warband, catalogue_item, draft, unit_result


class FixturePostbattleTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        rope = catalogue_item("Rope", 5)
        self.charm = catalogue_item("Lucky Charm", 10)
        self.fixture = build_fixture_warband(self.warband, rope)
        self.heroes, self.swords, self.groups = self.fixture.heroes, self.fixture.hired_swords, self.fixture.groups
        self.henchmen = self.fixture.henchmen  # groups of 3, 3 and 2
        self.rat = f"hero:{self.rival.heroes.create(name='Rat', unit_type='Assassin').id}"
        self.resource = WarbandResource.objects.create(warband=self.warband, name="Wyrdstone", amount=1)
        WarbandItem.objects.create(warband=self.warband, item=self.charm, quantity=1, cost=4)

    def start(self, **info: dict[str, Any]) -> int:
        """An active battle with every fixture unit selected; `info` is config's unit_information by key."""
        battle_id = self.to_active({self.player: self.fixture.keys, self.viewer: [self.rat]})
        if info:
            self.select(self.player, battle_id, self.fixture.keys, **info)
        return battle_id

    def results(self, **changes: dict[str, Any]) -> dict[str, dict[str, Any]]:
        """A unit result for every fixture unit, with `changes` (unit_result arguments) by unit key."""
        return {key: unit_result(key, **changes.get(key, {})) for key in self.fixture.keys}

    def key(self, unit: Any) -> str:
        kind = {"Hero": "hero", "HiredSword": "hired_sword", "Henchman": "henchman"}[type(unit).__name__]
        return f"{kind}:{unit.id}"

    def test_finalise_applies_xp_deaths_exploration_upkeep_reward_and_finds(self):
        battle_id = self.start()
        self.finish(battle_id, [self.warband])
        h, s, m = self.heroes, self.swords, self.henchmen
        changes: dict[str, dict[str, Any]] = {self.key(h[0]): {"xp": 3}, self.key(h[1]): {"xp": 1}}
        changes |= {self.key(h[4]): {"dead": True}, self.key(s[0]): {"xp": 2}}
        changes |= {self.key(member): {"xp": 1} for member in m[:3]}  # group 0
        changes |= {self.key(m[3]): {"dead": True}} | {self.key(member): {"xp": 2} for member in m[6:]}
        postbattle = draft(
            self.results(**changes),
            exploration={"dice_values": [3, 4], "resource_id": self.resource.id},
            finds={"gold_crowns": 25, "items": [{"item_id": self.charm.id, "name": "Charm", "cost": 1}]},
            upkeep={
                "pay_upkeep": True,
                "entries": {self.key(sword): {"unit_name": sword.name, "cost": 15} for sword in s},
            },
        )

        self.ok(self.finalize(self.player, battle_id, postbattle))

        for unit in (*h, *s, *self.groups, *m):
            unit.refresh_from_db()
        self.assertEqual(
            [(hero.xp, hero.level_up, hero.dead) for hero in h][:2], [(Decimal(3), 1, False), (Decimal(1), 0, False)]
        )
        self.assertEqual([hero.dead for hero in h], [False, False, False, False, True])
        self.assertEqual([sword.xp for sword in s], [Decimal(2), Decimal(0)])
        self.assertEqual(
            [(group.xp, group.dead) for group in self.groups],
            [(Decimal(1), False), (Decimal(0), False), (Decimal(2), False)],
        )
        self.assertEqual([member.dead for member in m], [False, False, False, True, False, False, False, False])
        self.resource.refresh_from_db()
        self.assertEqual(self.resource.amount, 3)  # dice total 7: 2 shards
        self.assertEqual(
            trade_rows(self.warband),
            [("Upkeep", "Post-battle upkeep", -30, None), ("Reward", "Battle reward", 25, None)],
        )
        notes = list(self.warband.trades.order_by("id").values_list("notes", flat=True))
        self.assertEqual(notes, ["Sword 0: 15 gc\nSword 1: 15 gc", "Postbattle finds from Bridge"])
        self.assertEqual(Warband.objects.get(id=self.warband.id).gold, -5)
        stash = WarbandItem.objects.filter(warband=self.warband).order_by("cost")
        self.assertEqual(
            list(stash.values_list("item__name", "quantity", "cost")), [("Lucky Charm", 1, 4), ("Lucky Charm", 1, 10)]
        )
        find = {"item_id": self.charm.id, "name": "Lucky Charm", "type": "Misc", "cost": 10}  # the catalogue's cost
        self.assertEqual(
            log_rows(self.warband),
            [
                ("battle", "complete", {"result": "won", "with": [], "against": ["Rats"]}, None),
                (
                    "battle",
                    "exploration",
                    {"dice": [3, 4], "amount": 2, "amount_override": None, "resource": "Wyrdstone", "rerolls": []},
                    None,
                ),  # fmt: skip
                ("battle", "finds", {"gold_crowns": 25, "items": [find]}, None),
            ],
        )  # deaths and XP are not logged

    def test_upkeep_entries_without_a_price_charge_nothing(self):
        battle_id = self.start()
        self.finish(battle_id, [self.warband])
        entries = {self.key(self.swords[0]): {"cost": None}, self.key(self.swords[1]): {"cost": 0}}

        self.ok(
            self.finalize(
                self.player, battle_id, draft(self.results(), upkeep={"pay_upkeep": True, "entries": entries})
            )
        )

        self.assertEqual(trade_rows(self.warband), [])

    def test_stat_overrides_become_permanent_without_a_log(self):
        # Characterises current behaviour (SEC-10, pinned; flips in PR A: kept only with keep_stats, and logged)
        h0, m0, m1 = self.key(self.heroes[0]), self.key(self.henchmen[0]), self.key(self.henchmen[1])
        override = {"stats_override": {"strength": 5}}
        info: dict[str, dict[str, Any]] = {h0: {"stats_override": {"weapon_skill": 7, "armour_save": "4+"}}}
        battle_id = self.start(**info, **{m0: override, m1: override})
        self.finish(battle_id, [self.warband])

        self.ok(self.finalize(self.player, battle_id, draft(self.results())))

        hero, group = self.heroes[0], self.groups[0]
        hero.refresh_from_db()
        group.refresh_from_db()
        self.assertEqual((hero.weapon_skill, hero.armour_save, group.strength), (7, 4, 5))
        self.assertEqual(
            [(feature, entry) for feature, entry, _, _ in log_rows(self.warband)],
            [("battle", "complete"), ("battle", "exploration")],
        )

    def test_henchmen_of_one_group_must_share_overrides_and_xp(self):
        m0, m1 = self.key(self.henchmen[0]), self.key(self.henchmen[1])
        battle_id = self.start(**{m0: {"stats_override": {"strength": 5}}, m1: {"stats_override": {"strength": 4}}})
        self.finish(battle_id, [self.warband])
        response = self.finalize(self.player, battle_id, draft(self.results()))
        detail = "All henchmen in a group must share the same stat overrides"
        self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))

        self.select(self.player, battle_id, self.fixture.keys)
        response = self.finalize(self.player, battle_id, draft(self.results(**{m0: {"xp": 1}})))
        detail = "All henchmen in a group must share the same xp_earned value"
        self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))

    def test_unusual_numbers_are_accepted_silently(self):
        # Characterises current behaviour (SEC-10, BUG-71, pinned; flips in PR A: unusual values warn and are logged)
        battle_id = self.start()
        self.finish(battle_id, [self.warband])
        h1 = self.key(self.heroes[1])
        postbattle = draft(
            self.results(**{h1: {"xp": 10_000}}),
            exploration={"dice_values": [1], "resource_id": self.resource.id, "amount_override": 500},
            finds={"gold_crowns": 1_000_000, "items": []},
        )

        self.ok(self.finalize(self.player, battle_id, postbattle))

        self.heroes[1].refresh_from_db()
        self.resource.refresh_from_db()
        self.assertEqual((self.heroes[1].xp, self.resource.amount), (Decimal(9999), 501))
        self.assertEqual(trade_rows(self.warband), [("Reward", "Battle reward", 999_999, None)])
        exploration = {"dice": [1], "amount": 500, "amount_override": 500, "resource": "Wyrdstone", "rerolls": []}
        self.assertEqual(log_rows(self.warband)[1][2], exploration)  # the override is logged (decision 9)

    def test_dead_units_keep_their_items(self):
        # Characterises current behaviour (pass 2 decision 7, BATL-TWEAK-08; flips in PR A: a dead hero's or hired
        # sword's items stay on his record out of reach, and each dead henchman takes one copy of each group item)
        battle_id = self.start()
        self.finish(battle_id, [self.warband])
        dead = [self.heroes[1], self.swords[0], self.henchmen[6]]
        changes = {self.key(unit): {"dead": True} for unit in dead}

        self.ok(self.finalize(self.player, battle_id, draft(self.results(**changes))))

        self.assertEqual(HeroItem.objects.filter(hero=self.heroes[1]).count(), 1)
        self.assertEqual(HiredSwordItem.objects.filter(hired_sword=self.swords[0]).count(), 1)
        self.assertEqual(HenchmenGroupItem.objects.filter(henchmen_group=self.groups[2]).count(), 1)
        self.henchmen[6].refresh_from_db()
        self.assertTrue(self.henchmen[6].dead)

    def test_a_whole_group_dying_marks_the_group_dead(self):
        battle_id = self.start()
        self.finish(battle_id, [self.warband])
        changes = {self.key(member): {"dead": True} for member in self.henchmen[6:]}

        self.ok(self.finalize(self.player, battle_id, draft(self.results(**changes))))

        self.groups[2].refresh_from_db()
        self.assertTrue(self.groups[2].dead)

    def test_the_crown_moves_to_the_first_living_hero_when_the_leader_dies(self):
        battle_id = self.start()
        self.finish(battle_id, [self.warband])

        self.ok(
            self.finalize(self.player, battle_id, draft(self.results(**{self.key(self.heroes[0]): {"dead": True}})))
        )

        leaders = [hero.is_leader for hero in self.warband.heroes.order_by("id")]
        self.assertEqual(leaders, [False, True, False, False, False])

    def test_a_failed_finalise_writes_nothing_and_a_retry_applies_once(self):
        # BUG-124: the 400 rolls the whole finalise back, so the units, exploration and upkeep it wrote before the
        # finds were checked are gone, and a retry applies them once
        no_price = catalogue_item("Strange Idol", None)
        battle_id = self.start()
        self.finish(battle_id, [self.warband])
        h0 = self.key(self.heroes[0])
        sword = self.key(self.swords[0])
        postbattle = draft(
            self.results(**{h0: {"xp": 3}}),
            exploration={"dice_values": [3], "resource_id": self.resource.id},
            upkeep={"pay_upkeep": True, "entries": {sword: {"cost": 15}}},
            finds={"gold_crowns": 0, "items": [{"item_id": no_price.id}]},
        )

        response = self.finalize(self.player, battle_id, postbattle)

        detail = "One or more found items no longer have an available cost"
        self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))
        self.assertEqual(self.participant(battle_id, self.player).status, "finished_battle")
        self.heroes[0].refresh_from_db()
        self.resource.refresh_from_db()
        self.assertEqual((self.heroes[0].xp, self.resource.amount), (Decimal(0), 1))
        self.assertEqual((trade_rows(self.warband), log_rows(self.warband)), ([], []))

        postbattle["finds"] = {"gold_crowns": 0, "items": []}
        self.ok(self.finalize(self.player, battle_id, postbattle))
        self.heroes[0].refresh_from_db()
        self.resource.refresh_from_db()
        self.assertEqual((self.heroes[0].xp, self.resource.amount), (Decimal(3), 2))
        self.assertEqual([price for _, _, price, _ in trade_rows(self.warband)], [-15])
