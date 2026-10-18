"""Undoing kills and item uses, and adding kills in postbattle (decision 5, BUG-11, BATL-TWEAK-03, BATL-NEW-06).

A player voids his own kill or item use until he finalises; the event stays in the timeline, marked voided, with a
`*_voided` event after it. Finalise, the live kill_count, pivotal moments and kill history count only live kills.
"""

from apps.battles.models import BattleEvent
from apps.warbands.models import Hero, HeroItem

from .battle_support import BattleTestCase, catalogue_item, draft, unit_result


class BattleUndoTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.abbess = Hero.objects.create(warband=self.warband, name="Abbess", unit_type="Matriarch")
        self.rat = Hero.objects.create(warband=self.rival, name="Rat", unit_type="Assassin")
        self.potion = catalogue_item("Healing Draught", 10, single_use=True)
        HeroItem.objects.create(hero=self.abbess, item=self.potion, cost=10)
        self.a, self.r = f"hero:{self.abbess.id}", f"hero:{self.rat.id}"
        self.battle_id = self.to_active({self.player: [self.a], self.viewer: [self.r]})

    def void(self, user, event_id: int):
        return self.post_as(user, f"{self.url(self.battle_id, 'events')}{event_id}/void/")

    def kill_count(self) -> int:
        info = self.participant(self.battle_id, self.player).unit_information_json
        return int(info.get(self.a, {}).get("kill_count", 0))

    def test_an_undone_kill_counts_nowhere(self):
        first = self.ok(self.kill(self.player, self.battle_id, self.a, self.r), 201).data["events"][0]["id"]
        self.ok(self.kill(self.player, self.battle_id, self.a, self.r), 201)
        self.assertEqual(self.kill_count(), 2)

        data = self.ok(self.void(self.player, first)).data

        self.assertEqual(
            [(event["type"], event["payload_json"]) for event in data["events"]],
            [("unit_kill_voided", {"voided_event_id": first, "unit_key": self.a})],
        )
        self.assertIsNotNone(BattleEvent.objects.get(id=first).voided_at)
        self.assertEqual(self.kill_count(), 1)
        state = self.ok(self.get_as(self.viewer, self.url(self.battle_id, "state"))).data
        voided = next(event for event in state["events"] if event["id"] == first)
        self.assertIsNotNone(voided["voided_at"])  # still in the timeline
        self.assertEqual(self.ok(self.void(self.player, first)).data["events"], [])  # again: nothing new

        self.finish(self.battle_id, [self.warband])
        self.ok(self.finalize(self.player, self.battle_id, draft({self.a: unit_result(self.a)})))
        self.abbess.refresh_from_db()
        self.assertEqual(self.abbess.kills, 1)

    def test_an_undone_item_use_keeps_the_item(self):
        use = {"unit_key": self.a, "item_id": self.potion.id}
        event_id = self.ok(self.use_item(self.player, self.battle_id, use), 201).data["events"][0]["id"]

        self.assertEqual(self.ok(self.void(self.player, event_id)).data["events"][0]["type"], "item_used_voided")
        self.finish(self.battle_id, [self.warband])
        self.ok(self.post_as(self.player, self.url(self.battle_id, "confirm")))

        self.assertTrue(HeroItem.objects.filter(hero=self.abbess, item=self.potion).exists())

    def test_only_your_own_kills_and_item_uses_until_you_finalise(self):
        kill = self.ok(self.kill(self.player, self.battle_id, self.a, self.r), 201).data["events"][0]["id"]
        response = self.void(self.viewer, kill)
        self.assertEqual((response.status_code, response.data["code"]), (403, "not_your_event"))
        started = BattleEvent.objects.get(battle_id=self.battle_id, type="battle_started").id
        response = self.void(self.player, started)
        self.assertEqual((response.status_code, response.data["code"]), (400, "not_undoable"))
        self.assertEqual(self.void(self.player, kill + 999).status_code, 404)

        self.finish(self.battle_id, [self.warband])
        self.ok(self.finalize(self.player, self.battle_id, draft({self.a: unit_result(self.a)})))
        response = self.void(self.player, kill)
        self.assertEqual((response.status_code, response.data["code"]), (400, "already_finalised"))
        self.assertIsNone(BattleEvent.objects.get(id=kill).voided_at)


class PostbattleKillTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.abbess = Hero.objects.create(warband=self.warband, name="Abbess", unit_type="Matriarch")
        self.rat = Hero.objects.create(warband=self.rival, name="Rat", unit_type="Assassin")
        self.a, self.r = f"hero:{self.abbess.id}", f"hero:{self.rat.id}"

    def test_a_kill_added_in_postbattle_counts_even_for_a_unit_taken_out(self):
        battle_id = self.to_active({self.player: [self.a], self.viewer: [self.r]})
        self.ok(self.post_as(self.player, self.url(battle_id, "unit-ooa"), {"unit_key": self.a, "out_of_action": True}), 201)  # fmt: skip
        self.finish(battle_id, [self.warband])

        response = self.kill(self.player, battle_id, self.a, self.r)  # without source: an active-page tap
        self.assertEqual((response.status_code, response.data), (400, {"detail": "Battle is not active"}))
        data = self.ok(self.kill(self.player, battle_id, self.a, self.r, source="postbattle"), 201).data

        self.assertEqual(data["events"][0]["payload_json"]["source"], "postbattle")
        self.ok(self.finalize(self.player, battle_id, draft({self.a: unit_result(self.a)})))
        self.abbess.refresh_from_db()
        self.assertEqual(self.abbess.kills, 1)
        response = self.kill(self.player, battle_id, self.a, self.r, source="postbattle")  # finalised
        self.assertEqual((response.status_code, response.data["code"]), (400, "not_in_postbattle"))
