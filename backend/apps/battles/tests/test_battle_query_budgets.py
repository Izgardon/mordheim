"""Query budgets for the battle endpoints at today's counts (pass 3, step 0; BATL-TEST-05, -07 and -19).

Each budget is the count measured today with `force_authenticate` (production adds one JWT user query). A write
runs in transaction.atomic(), which inside the test's own transaction is a SAVEPOINT and a RELEASE (2 queries of
each write's count). A test fails if an endpoint needs MORE queries than its budget; PR A and PR B lower them in
the commit that makes them cheaper (targets: state/ at most 4, finalise of the fixture at most 30, rosters/
served from the start snapshot).
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.battles.models import BattleEvent, BattleParticipant
from apps.warbands.models import Warband, WarbandResource

from .battle_support import BattleTestCase, build_fixture_warband, catalogue_item, draft, unit_result


class BattleQueryBudgetTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.rope = catalogue_item("Rope", 5)
        self.fixture = build_fixture_warband(self.warband, self.rope)
        self.rat = self.rival.heroes.create(name="Rat", unit_type="Assassin")
        self.r = f"hero:{self.rat.id}"

    def count(self, user: Any, method: str, url: str, body: dict[str, Any] | None = None) -> tuple[int, Any]:
        self.client.force_authenticate(user=user)
        with CaptureQueriesContext(connection) as captured:
            response = getattr(self.client, method)(url, body or {}, format="json")
        self.assertIn(response.status_code, (200, 201), getattr(response, "data", None))
        return len(captured), captured

    def within(self, name: str, queries: int, budget: int) -> None:
        self.assertLessEqual(queries, budget, f"{name} ran {queries} queries (budget {budget}).")

    def test_state_costs_the_same_for_any_number_of_players_and_events(self):
        # BATL-TEST-05 baseline (target 4): membership, battle, the reader's participant, every participant, the new
        # events; constant in players and events. Presence is written by the reader's first read in a minute (writes
        # no longer touch it, PERF-35), so each battle is read once first; the reference campaign's budget, 6 in
        # apps/core/tests/test_query_budgets.py, includes that write.
        small = self.to_active({self.player: [], self.viewer: [self.r]})
        self.ok(self.get_as(self.player, self.url(small, "state")))
        small_count, _ = self.count(self.player, "get", self.url(small, "state"))
        self.ok(self.post_as(self.player, self.url(small, "cancel-battle")))

        Warband.objects.create(campaign=self.campaign, user=self.manager, name="Crows", faction="X")
        big = self.to_active({self.player: self.fixture.keys, self.viewer: [self.r], self.manager: []})
        battle = self.battle(big)
        BattleEvent.objects.bulk_create(
            BattleEvent(battle=battle, type="item_used", payload_json={}) for _ in range(50)
        )
        self.ok(self.get_as(self.player, self.url(big, "state")))
        big_count, _ = self.count(self.player, "get", self.url(big, "state"))

        self.assertEqual(small_count, big_count)
        self.within("state", big_count, 5)

    def test_rosters_cost_the_same_for_any_number_of_units(self):
        # PERF-38: before the battle starts, membership, battle, participant, participants, then each kind and its
        # link tables. A nested prefetch is skipped when its link table has no rows: 22 here (items only), up to 30
        # with skills, specials and spells everywhere, but never more for more units. From the start on, the snapshot
        # start/ stored: membership, battle, participant and participants. The first read in a minute also writes
        # presence (PERF-35), so each is read once first.
        battle_id = self.to_prebattle()
        self.ok(self.get_as(self.viewer, self.url(battle_id, "rosters")))
        few, _ = self.count(self.viewer, "get", self.url(battle_id, "rosters"))
        build_fixture_warband(self.rival, self.rope)
        many, _ = self.count(self.viewer, "get", self.url(battle_id, "rosters"))
        self.assertEqual(few, many)
        self.within("rosters_live", many, 22)

        for user in (self.player, self.viewer):
            self.ok(self.post_as(user, self.url(battle_id, "ready"), {"ready": True}))
        self.ok(self.post_as(self.player, self.url(battle_id, "start")))
        snapshot, _ = self.count(self.viewer, "get", self.url(battle_id, "rosters"))
        self.within("rosters_snapshot", snapshot, 4)

    def test_live_writes_stay_within_budget(self):
        hero = self.fixture.heroes[1]
        h = f"hero:{hero.id}"
        battle_id = self.to_active({self.player: self.fixture.keys, self.viewer: [self.r]})
        info = {"unit_information_json": {h: {"current_wounds": 1}}}
        # Each: membership, the battle and participant locked, the write, its event, the battle's state_version
        # (PERF-34; the realtime sends go after commit) and the answer's fresh snapshot (2); no presence write since
        # PERF-35. A kill also locks every participant and reads both units; an item use checks the unit carries the
        # item (BUG-72); End also locks every participant and resets trading actions (wins and losses count when the
        # battle ends, decision 3).
        cases: list[tuple[str, str, dict[str, Any], int]] = [
            ("config", "config", info, 9),
            ("unit_ooa", "unit-ooa", {"unit_key": f"hero:{self.fixture.heroes[2].id}", "out_of_action": True}, 10),
            ("unit_kill", "unit-kill", {"killer_unit_key": h, "victim_unit_key": self.r}, 13),
            (
                "item_used",
                "events",
                {"type": "item_used", "payload_json": {"unit_key": h, "item_id": self.rope.id}},
                10,
            ),
            ("finish", "finish", {"winner_warband_ids": [self.warband.id]}, 17),
        ]
        for name, action, body, budget in cases:
            with self.subTest(write=name):
                queries, _ = self.count(self.player, "post", self.url(battle_id, action), body)
                self.within(name, queries, budget)

    def test_writes_leave_presence_alone(self):
        # PERF-35: no write updates the writer's presence (an UPDATE each); only reads do, at most once a minute
        battle_id = self.to_active({self.player: [f"hero:{self.fixture.heroes[0].id}"], self.viewer: [self.r]})
        BattleParticipant.objects.filter(battle_id=battle_id).update(last_seen_at=None, connection_state="offline")
        self.ok(self.post_as(self.player, self.url(battle_id, "config"), {"battle_notes": "x"}))
        self.ok(self.kill(self.player, battle_id, f"hero:{self.fixture.heroes[0].id}", self.r), 201)
        self.finish(battle_id, [self.warband])
        self.ok(self.post_as(self.player, self.url(battle_id, "confirm")))

        rows = BattleParticipant.objects.filter(battle_id=battle_id).values_list("last_seen_at", "connection_state")
        self.assertEqual(list(rows.distinct()), [(None, "offline")])

    def _fixture_postbattle(
        self, active_writes: list[tuple[str, dict[str, Any]]] | None = None
    ) -> tuple[int, dict[str, Any]]:
        """The fixture in postbattle, and its finalise: XP for every unit, a death, exploration, upkeep, a find.
        `active_writes` are (action, body) posts the player makes before the battle ends."""
        charm = catalogue_item("Lucky Charm", 10)
        resource = WarbandResource.objects.create(warband=self.warband, name="Wyrdstone")
        battle_id = self.to_active({self.player: self.fixture.keys, self.viewer: [self.r]})
        for action, body in active_writes or []:
            self.ok(self.post_as(self.player, self.url(battle_id, action), body), 201)
        self.finish(battle_id, [self.warband])
        results = {key: unit_result(key, xp=1) for key in self.fixture.keys}
        results[f"hero:{self.fixture.heroes[4].id}"]["dead"] = True
        sword = f"hired_sword:{self.fixture.hired_swords[0].id}"
        return battle_id, draft(
            results,
            exploration={"dice_values": [3, 4], "resource_id": resource.id},
            upkeep={"pay_upkeep": True, "entries": {sword: {"cost": 15}}},
            finds={"gold_crowns": 10, "items": [{"item_id": charm.id}]},
        )

    def test_finalising_the_fixture_warband_stays_within_budget(self):
        # BATL-TEST-07 baseline (target 30, PERF-36): the first of two players to finalise. It validates twice, saves
        # each unit and every henchman one by one, checks each group's survivors, and writes each log singly.
        battle_id, postbattle = self._fixture_postbattle()
        body = {"postbattle_json": postbattle}
        queries, _ = self.count(self.player, "post", self.url(battle_id, "finalize-postbattle"), body)
        self.within("finalise_first", queries, 67)

    def test_finalising_the_fixture_warband_last_stays_within_budget(self):
        # + ending the battle: its event, the wins and losses (the warbands in it, then one UPDATE each for winners
        # and losers; decision 3 moved them here from End) and the pivotal moments (the trading reset went to End
        # only, BUG-122)
        battle_id, postbattle = self._fixture_postbattle()
        self.ok(self.post_as(self.viewer, self.url(battle_id, "confirm")))
        body = {"postbattle_json": postbattle}
        queries, _ = self.count(self.player, "post", self.url(battle_id, "finalize-postbattle"), body)
        self.assertEqual(self.battle(battle_id).status, "ended")
        self.within("finalise_last", queries, 76)

    def test_a_locked_battle_write_locks_only_the_battle_and_participant_rows(self):
        # PERF-37, BATL-TEST-19: the battle row first, then the participant, whose query joins its user and warband
        # but locks only its own row (FOR UPDATE OF)
        battle_id = self.to_active({self.player: [], self.viewer: [self.r]})
        _, captured = self.count(self.player, "post", self.url(battle_id, "config"), {"battle_notes": "x"})
        locks = [query["sql"] for query in captured if "FOR UPDATE" in query["sql"]]

        self.assertEqual(len(locks), 2)
        self.assertIn('FROM "battle" WHERE', locks[0])
        self.assertIn('FROM "battle_participant" INNER JOIN "auth_user"', locks[1])
        self.assertTrue(locks[1].rstrip().endswith('FOR UPDATE OF "battle_participant"'), locks[1])

    def test_no_locked_query_locks_the_rows_it_joins(self):
        # PERF-37: every FOR UPDATE that joins another table names its own (finalise locks units, item rows and
        # henchmen through joins)
        potion = catalogue_item("Potion", 5, single_use=True)
        hero = self.fixture.heroes[0]
        hero.hero_items.create(item=potion, cost=5)
        battle_id, postbattle = self._fixture_postbattle(
            active_writes=[
                (
                    "events",
                    {"type": "item_used", "payload_json": {"unit_key": f"hero:{hero.id}", "item_id": potion.id}},
                ),
            ]
        )
        _, captured = self.count(
            self.player, "post", self.url(battle_id, "finalize-postbattle"), {"postbattle_json": postbattle}
        )

        joined_locks = [query["sql"] for query in captured if "FOR UPDATE" in query["sql"] and " JOIN " in query["sql"]]
        self.assertGreaterEqual(len(joined_locks), 3)  # participant, henchmen, the potion's item row
        for sql in joined_locks:
            with self.subTest(sql=sql[:80]):
                self.assertRegex(sql.rstrip(), r'FOR UPDATE OF "[a-z_]+"$')

    def test_finalise_locks_the_warband_before_any_unit(self):
        # BUG-106: the roster paths' order (warband, then units), so a leader PATCH can't deadlock with a finalise.
        # Since PERF-37 the participant join no longer locks the warband; finalise locks it itself, before any unit.
        battle_id, postbattle = self._fixture_postbattle()
        body = {"postbattle_json": postbattle}
        _, captured = self.count(self.player, "post", self.url(battle_id, "finalize-postbattle"), body)
        sql = [query["sql"] for query in captured]

        warband = next(i for i, text in enumerate(sql) if "FOR UPDATE" in text and 'FROM "warband" WHERE' in text)
        hero = next(i for i, text in enumerate(sql) if "FOR UPDATE" in text and 'FROM "hero"' in text)
        self.assertLess(warband, hero)
