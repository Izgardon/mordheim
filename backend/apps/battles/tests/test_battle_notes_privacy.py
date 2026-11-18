"""Battle notes are the writer's alone ("Only you see these").

A player's `battle_notes` used to sit on his participant in every snapshot, and a snapshot goes to the whole battle
channel, so every other player read them through the API and through the socket. Now no participant carries them: a
snapshot read for someone adds his own as `your_notes`, and a broadcast, which one message sends to everyone, is
built without a reader and so carries nobody's.
"""

import json
from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from .battle_support import BattleTestCase

MINE = "Hold the bridge, then fall back to the well."
THEIRS = "Rush the flank while he holds the bridge."


class BattleNotesPrivacyTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.abbess = self.warband.heroes.create(name="Abbess", unit_type="Matriarch")
        self.rat = self.rival.heroes.create(name="Rat", unit_type="Assassin")
        self.a, self.r = f"hero:{self.abbess.id}", f"hero:{self.rat.id}"

    def write_notes(self, user: Any, battle_id: int, notes: str) -> Any:
        return self.ok(self.post_as(user, self.url(battle_id, "config"), {"battle_notes": notes}))

    def state(self, user: Any, battle_id: int, view: str = "full") -> Any:
        return self.ok(self.get_as(user, f"{self.url(battle_id, 'state')}?view={view}")).data

    def broadcast(self) -> str:
        """Everything that went to the battle channel, as text."""
        return json.dumps(
            [(call.args[1], call.args[2], call.kwargs) for call in self.battle_events.call_args_list], default=str
        )

    def test_nothing_of_a_players_notes_reaches_anyone_else(self):
        battle_id = self.to_active({self.player: [self.a], self.viewer: [self.r]})
        self.write_notes(self.player, battle_id, MINE)
        self.write_notes(self.viewer, battle_id, THEIRS)
        self.battle_events.reset_mock()

        # a write of the other player's, which broadcasts his snapshot to the whole channel
        his_answer = self.ok(self.post_as(self.viewer, self.url(battle_id, "finish-mine"), {"result": "lost"}))

        for payload in (self.state(self.viewer, battle_id), his_answer.data):
            self.assertNotIn(MINE, json.dumps(payload, default=str))
            self.assertTrue(all("battle_notes" not in entry for entry in payload["participants"]))
            self.assertEqual(payload["your_notes"], THEIRS)  # his own, nobody else's
        self.assertNotIn(MINE, self.broadcast())
        self.assertNotIn(THEIRS, self.broadcast())

    def test_the_battles_list_carries_nobodys_notes(self):
        battle_id = self.to_active({self.player: [self.a], self.viewer: [self.r]})
        self.write_notes(self.player, battle_id, MINE)

        listed = self.ok(self.get_as(self.viewer, self.battles_url())).data

        self.assertEqual([entry["battle"]["id"] for entry in listed], [battle_id])
        self.assertNotIn(MINE, json.dumps(listed, default=str))

    def test_the_author_reads_his_own_in_every_view_and_in_his_write_answers(self):
        battle_id = self.to_active({self.player: [self.a], self.viewer: [self.r]})

        answer = self.write_notes(self.player, battle_id, MINE)

        self.assertEqual(answer.data["your_notes"], MINE)
        for view in ("full", "prebattle", "active", "postbattle"):
            self.assertEqual(self.state(self.player, battle_id, view)["your_notes"], MINE, view)
        self.assertEqual(self.state(self.viewer, battle_id)["your_notes"], "")  # he wrote none

    def test_his_own_notes_cost_no_query(self):
        # they come off the participants the snapshot already read: the state budget (4) doesn't move
        battle_id = self.to_active({self.player: [self.a], self.viewer: [self.r]})
        self.write_notes(self.player, battle_id, MINE)
        self.ok(self.get_as(self.player, self.url(battle_id, "state")))  # presence, written once a minute

        self.client.force_authenticate(user=self.player)
        with CaptureQueriesContext(connection) as captured:
            response = self.client.get(self.url(battle_id, "state"))

        self.assertEqual(response.data["your_notes"], MINE)
        self.assertLessEqual(len(captured), 4, f"state ran {len(captured)} queries (budget 4).")
