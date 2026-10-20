"""BUG-106: every battle write takes its row locks in one order (services/locks.py, LOCK_ORDER): the battle, the
participants, the warband, its units, then item, stash and resource rows, each `FOR UPDATE OF` its own table only.
Finalise holds the player's rows in one transaction and the battle row alone in a second.

Like BUG-105's test, this reads the SQL a request runs: each outermost SAVEPOINT ... RELEASE is one transaction.
"""

import re
from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.battles.services.locks import lock_rank

from .battle_support import BattleTestCase, build_fixture_warband, catalogue_item, draft, unit_result

LOCKED_TABLE = re.compile(r'FOR UPDATE OF "(\w+)"\s*$')


def locks_per_transaction(captured: CaptureQueriesContext) -> list[list[str]]:
    """The tables each outermost transaction locks, in the order it locks them."""
    transactions: list[list[str]] = []
    depth = 0
    for query in captured.captured_queries:
        sql = query["sql"]
        if sql.startswith("SAVEPOINT"):
            depth += 1
            if depth == 1:
                transactions.append([])
        elif sql.startswith(("RELEASE SAVEPOINT", "ROLLBACK TO SAVEPOINT")):
            depth -= 1
        elif "FOR UPDATE" in sql:
            match = LOCKED_TABLE.search(sql)
            assert match, f"a lock that doesn't name its own table: {sql[:120]}"
            transactions[-1].append(match.group(1))
    return transactions


class BattleLockOrderTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.rope = catalogue_item("Rope", 5)
        self.potion = catalogue_item("Potion", 5, single_use=True)
        self.fixture = build_fixture_warband(self.warband, self.rope)
        self.hero = self.fixture.heroes[0]
        self.hero.hero_items.create(item=self.potion, cost=5)
        self.rat = self.rival.heroes.create(name="Rat", unit_type="Assassin")
        self.h, self.r = f"hero:{self.hero.id}", f"hero:{self.rat.id}"

    def locks(self, user: Any, action: str, battle_id: int, body: dict[str, Any] | None = None) -> list[list[str]]:
        with CaptureQueriesContext(connection) as captured:
            response = self.post_as(user, self.url(battle_id, action), body)
        self.assertIn(response.status_code, (200, 201), getattr(response, "data", None))
        return locks_per_transaction(captured)

    def assert_in_order(self, name: str, transactions: list[list[str]]) -> None:
        for tables in transactions:
            ranks = [lock_rank(table) for table in tables]
            self.assertEqual(ranks, sorted(ranks), f"{name} locks {tables}")

    def test_a_battle_write_locks_the_battle_then_the_players_participant(self):
        battle_id = self.to_active({self.player: [self.h], self.viewer: [self.r]})
        self.assertEqual(self.locks(self.player, "config", battle_id, {"battle_notes": "x"}), [["battle", "battle_participant"]])  # fmt: skip

    def test_every_battle_write_follows_the_lock_order(self):
        battle_id = self.create_battle()
        writes: list[tuple[Any, str, dict[str, Any]]] = [
            (self.viewer, "join", {}),
            (self.player, "config", {"selected_unit_keys_json": self.fixture.keys}),
            (self.viewer, "config", {"selected_unit_keys_json": [self.r]}),
            (self.player, "ready", {"ready": True}),
            (self.viewer, "ready", {"ready": True}),
            (self.player, "start", {}),
            (
                self.player,
                "events",
                {"type": "item_used", "payload_json": {"unit_key": self.h, "item_id": self.potion.id}},
            ),  # fmt: skip
            (self.player, "unit-kill", {"killer_unit_key": self.h, "victim_unit_key": self.r}),
            (self.viewer, "unit-ooa", {"unit_key": self.r, "out_of_action": True}),
            (self.player, "finish-mine", {"result": "won"}),  # decision 4: each finishes his own battle
            (self.viewer, "finish-mine", {"result": "lost"}),
            (self.viewer, "results", {"winners": [self.warband.id]}),
            (
                self.player,
                "postbattle",
                {"postbattle_json": draft({key: unit_result(key) for key in self.fixture.keys})},
            ),  # fmt: skip
            (self.viewer, "confirm", {}),
            (
                self.player,
                "finalize-postbattle",
                {"postbattle_json": draft({key: unit_result(key, xp=1) for key in self.fixture.keys})},
            ),  # fmt: skip
        ]
        for user, action, body in writes:
            with self.subTest(write=action):
                self.assert_in_order(action, self.locks(user, action, battle_id, body))
        self.assertEqual(self.battle(battle_id).status, "ended")

    def test_finalise_holds_the_players_rows_then_the_battle_row_alone(self):
        battle_id = self.to_active({self.player: self.fixture.keys, self.viewer: [self.r]})
        self.ok(self.use_item(self.player, battle_id, {"unit_key": self.h, "item_id": self.potion.id}), 201)
        self.finish(battle_id, [self.warband])
        body = {"postbattle_json": draft({key: unit_result(key, xp=1) for key in self.fixture.keys})}

        transactions = self.locks(self.player, "finalize-postbattle", battle_id, body)

        units = ["hero", "hired_sword", "henchman", "henchmen_group"]
        self.assertEqual(transactions, [["battle_participant", "warband", *units, "hero_item"], ["battle"]])

    def test_closing_postbattle_locks_the_battle_then_the_players_it_skips(self):
        battle_id = self.to_postbattle({self.player: [self.h], self.viewer: [self.r]})
        transactions = self.locks(self.player, "close-postbattle", battle_id)
        self.assertEqual(transactions[0][:2], ["battle", "battle_participant"])
        self.assert_in_order("close-postbattle", transactions)
