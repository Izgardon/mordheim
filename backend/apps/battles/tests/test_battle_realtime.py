"""What other players' clients receive after a battle write (PERF-34 server half, BUG-75 server half).

Every write others see raises `Battle.state_version` once; its messages carry the version, and the last one the
snapshots of the participants it changed; the sender's own socket is skipped. Notes and drafts broadcast nothing.
"""

from typing import Any

from apps.battles.services.broadcast import SNAPSHOT_LIMIT_BYTES

from .battle_support import BattleTestCase, draft, unit_result


class BattleBroadcastTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.abbess = self.warband.heroes.create(name="Abbess", unit_type="Matriarch")
        self.rat = self.rival.heroes.create(name="Rat", unit_type="Assassin")
        self.a, self.r = f"hero:{self.abbess.id}", f"hero:{self.rat.id}"

    def messages(self) -> list[tuple[str, dict[str, Any]]]:
        """(event, keyword fields) for each battle-channel message so far."""
        return [(call.args[1], dict(call.kwargs)) for call in self.battle_events.call_args_list]

    def post_with_socket(self, user: Any, url: str, body: dict[str, Any], socket_id: str) -> Any:
        self.client.force_authenticate(user=user)
        return self.client.post(url, body, format="json", HTTP_X_PUSHER_SOCKET_ID=socket_id)

    def test_each_write_raises_the_version_once_and_carries_it(self):
        battle_id = self.to_active({self.player: [self.a], self.viewer: [self.r]})

        versions = [fields["state_version"] for _, fields in self.messages()]
        # created, two config saves (selections), accepted, two readies, started (one event each)
        self.assertEqual(versions, list(range(1, len(versions) + 1)))
        state = self.ok(self.get_as(self.player, self.url(battle_id, "state"))).data
        self.assertEqual(state["battle"]["state_version"], versions[-1])
        event, fields = self.messages()[-1]
        self.assertEqual(event, "battle_started")
        self.assertEqual([entry["user"]["id"] for entry in fields["participants"]], [self.player.id, self.viewer.id])

    def test_a_kill_carries_the_killers_snapshot_and_skips_the_senders_socket(self):
        battle_id = self.to_active({self.player: [self.a], self.viewer: [self.r]})
        before = self.battle(battle_id).state_version
        body = {"killer_unit_key": self.a, "victim_unit_key": self.r}

        self.ok(self.post_with_socket(self.player, self.url(battle_id, "unit-kill"), body, "123.456"), 201)

        call = self.battle_events.call_args
        self.assertEqual((call.args[1], call.kwargs["socket_id"]), ("unit_kill_recorded", "123.456"))
        self.assertEqual(call.kwargs["state_version"], before + 1)
        self.assertEqual(call.kwargs["battle"]["state_version"], before + 1)
        (participant,) = call.kwargs["participants"]
        self.assertEqual((participant["user"]["id"], participant["unit_information_json"][self.a]["kill_count"]), (self.player.id, 1))  # fmt: skip
        self.assertNotIn("snapshot_omitted", call.kwargs)

        self.ok(self.post_with_socket(self.player, self.url(battle_id, "unit-kill"), body, "not-a-socket"), 201)
        self.assertIsNone(self.battle_events.call_args.kwargs["socket_id"])  # malformed: everyone gets it

    def test_notes_saves_neither_broadcast_nor_raise_the_version(self):
        battle_id = self.to_active({self.player: [self.a], self.viewer: [self.r]})
        sent, version = len(self.messages()), self.battle(battle_id).state_version
        url = self.url(battle_id, "config")

        self.ok(self.post_as(self.player, url, {"battle_notes": "ambush", "unit_information_patch": {self.a: {"notes": "brave"}}}))  # fmt: skip
        self.ok(self.post_as(self.player, url, {"selected_unit_keys_json": [self.a]}))  # unchanged

        self.assertEqual((len(self.messages()), self.battle(battle_id).state_version), (sent, version))
        self.ok(self.post_as(self.player, url, {"unit_information_patch": {self.a: {"current_wounds": 1}}}))
        event, fields = self.messages()[-1]
        self.assertEqual((event, fields["state_version"]), ("battle_state_updated", version + 1))
        self.assertEqual(self.battle_events.call_args.args[2]["reason"], "participant_config_updated")
        self.assertEqual([entry["user"]["id"] for entry in fields["participants"]], [self.player.id])

    def test_a_write_with_two_events_sends_both_with_one_version_and_the_snapshot_last(self):
        battle_id = self.to_postbattle({self.player: [self.a], self.viewer: [self.r]})
        self.ok(self.post_as(self.viewer, self.url(battle_id, "confirm")))
        version = self.battle(battle_id).state_version
        sent = len(self.messages())

        self.ok(self.finalize(self.player, battle_id, draft({self.a: unit_result(self.a)})))

        (first, first_fields), (last, last_fields) = self.messages()[sent:]
        self.assertEqual((first, last), ("participant_confirmed_postbattle", "battle_ended"))
        self.assertEqual(first_fields, {"socket_id": None, "state_version": version + 1})
        self.assertEqual(last_fields["state_version"], version + 1)
        self.assertEqual(len(last_fields["participants"]), 2)  # the battle ended: everyone changed

    def test_drafts_broadcast_nothing(self):
        battle_id = self.to_postbattle({self.player: [self.a], self.viewer: [self.r]})
        sent, version = len(self.messages()), self.battle(battle_id).state_version
        body = {"postbattle_json": draft({self.a: unit_result(self.a, xp=1)})}
        self.ok(self.post_as(self.player, self.url(battle_id, "postbattle"), body))
        self.assertEqual((len(self.messages()), self.battle(battle_id).state_version), (sent, version))

    def test_a_snapshot_too_big_for_pusher_is_left_out(self):
        battle_id = self.to_active({self.player: [self.a], self.viewer: [self.r]})
        notes = {f"custom:{n}": {"notes": "x" * 500} for n in range(SNAPSHOT_LIMIT_BYTES // 500 + 1)}
        self.ok(self.post_as(self.player, self.url(battle_id, "config"), {"unit_information_patch": notes}))

        self.ok(self.kill(self.player, battle_id, self.a, self.r), 201)

        fields = self.battle_events.call_args.kwargs
        self.assertEqual((fields["participants"], fields["snapshot_omitted"]), ([], True))
        self.assertEqual(fields["battle"]["id"], battle_id)
