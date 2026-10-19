"""Editing an ended battle's record (decision 3, BATL-NEW-04): `GET` and `PATCH record/`, behind manage_battles.

The scenario name and link, the date, the participants (with declared ratings) and the winners and losers change on
that battle's record only: no win/loss counter, XP, gold, kill or pivotal moment is recalculated. A participant taken
off is kept, marked removed; each edit is a battle_record_edited event with the editor and each change.
"""

from typing import Any

from apps.battles.models import BattleEvent
from apps.campaigns.models import PivotalMoment
from apps.warbands.models import Warband

from .battle_support import BattleTestCase, draft, status_changed, unit_result


class BattleRecordTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.abbess = self.warband.heroes.create(name="Abbess", unit_type="Matriarch", is_leader=True)
        self.rat = self.rival.heroes.create(name="Rat", unit_type="Assassin")
        self.a, self.r = f"hero:{self.abbess.id}", f"hero:{self.rat.id}"

    def ended(self) -> int:
        battle_id = self.to_postbattle({self.player: [self.a], self.viewer: [self.r]}, winners=[self.warband])
        self.ok(self.kill(self.player, battle_id, self.a, self.r, source="postbattle"), 201)
        self.ok(self.finalize(self.player, battle_id, draft({self.a: unit_result(self.a, xp=2)})))
        self.ok(self.post_as(self.viewer, self.url(battle_id, "skip-postbattle")))
        self.assertEqual(self.battle(battle_id).status, "ended")
        return battle_id

    def patch(self, user: Any, battle_id: int, body: dict[str, Any]) -> Any:
        self.client.force_authenticate(user=user)
        return self.client.patch(self.url(battle_id, "record"), body, format="json")

    def history(self, battle_id: int) -> dict[str, Any]:
        rows = self.ok(self.get_as(self.player, f"/api/campaigns/{self.campaign.id}/battle-history/")).data
        return next(row for row in rows if row["id"] == battle_id)

    def test_a_manager_edits_the_record_and_nothing_else_is_recalculated(self):
        battle_id = self.ended()
        before = (self.record(self.warband), self.record(self.rival), PivotalMoment.objects.count())
        self.abbess.refresh_from_db()
        xp, kills = self.abbess.xp, self.abbess.kills
        record = self.ok(self.get_as(self.campaign_owner, self.url(battle_id, "record"))).data
        self.assertEqual((record["scenario"], record["winner_warband_ids"], record["loser_warband_ids"]), ("Bridge", [self.warband.id], [self.rival.id]))  # fmt: skip
        played_on = record["date"]

        body = {"scenario": "Ford", "scenario_link": "https://example.com/ford", "date": "2026-10-01"}
        data = self.ok(self.patch(self.campaign_owner, battle_id, {**body, "winners": [self.rival.id]})).data

        record = data["record"]
        self.assertEqual((record["scenario"], record["scenario_link"], record["date"]), ("Ford", body["scenario_link"], "2026-10-01"))  # fmt: skip
        self.assertEqual((record["winner_warband_ids"], record["loser_warband_ids"]), ([self.rival.id], [self.warband.id]))  # fmt: skip
        changes = {
            "scenario": {"before": "Bridge", "after": "Ford"},
            "scenario_link": {"before": None, "after": body["scenario_link"]},
            "date": {"before": played_on, "after": "2026-10-01"},
            "winner_warband_ids": {"before": [self.warband.id], "after": [self.rival.id]},
        }
        event = data["events"][0]
        self.assertEqual((event["type"], event["payload_json"]), ("battle_record_edited", {"edited_by_user_id": self.campaign_owner.id, "changes": changes}))  # fmt: skip
        self.abbess.refresh_from_db()
        self.assertEqual((self.record(self.warband), self.record(self.rival), PivotalMoment.objects.count()), before)
        self.assertEqual((self.abbess.xp, self.abbess.kills), (xp, kills))
        self.assertEqual((self.history(battle_id)["scenario"], self.history(battle_id)["winners"]), ("Ford", ["Rats"]))

        again = self.ok(self.patch(self.campaign_owner, battle_id, {"scenario": "Ford"})).data
        self.assertEqual(again["events"], [])
        self.assertEqual(BattleEvent.objects.filter(battle_id=battle_id, type="battle_record_edited").count(), 1)

    def test_participants_are_taken_off_kept_added_and_rated(self):
        battle_id = self.ended()
        crows = Warband.objects.create(campaign=self.campaign, user=self.manager, name="Crows", faction="X")
        body = {"participants": [{"warband_id": self.warband.id, "declared_rating": 150}, {"warband_id": crows.id}]}

        data = self.ok(self.patch(self.campaign_owner, battle_id, {**body, "winners": [crows.id]})).data

        listed = {entry["warband_id"]: (entry["removed"], entry["declared_rating"]) for entry in data["record"]["participants"]}  # fmt: skip
        self.assertEqual(listed, {self.warband.id: (False, 150), self.rival.id: (True, None), crows.id: (False, None)})
        added = self.participant(battle_id, self.manager)
        self.assertEqual((added.status, added.skipped_postbattle), ("confirmed_postbattle", True))
        changes = data["events"][0]["payload_json"]["changes"]
        self.assertEqual(changes["participants"], {"before": sorted([self.warband.id, self.rival.id]), "after": sorted([self.warband.id, crows.id])})  # fmt: skip
        self.assertEqual(changes["declared_ratings"]["after"], {str(self.warband.id): 150, str(crows.id): None})
        self.assertEqual([entry["warband_name"] for entry in self.history(battle_id)["participants"]], ["Monks", "Crows"])  # fmt: skip

        body = {"participants": [{"warband_id": self.warband.id}, {"warband_id": self.rival.id}]}  # the Rats back
        data = self.ok(self.patch(self.campaign_owner, battle_id, body)).data
        self.assertTrue(next(entry for entry in data["record"]["participants"] if entry["warband_id"] == crows.id)["removed"])  # fmt: skip
        self.assertEqual(data["record"]["winner_warband_ids"], [])  # the Crows' win went with them

    def test_only_a_manager_edits_and_only_an_ended_battle(self):
        active = self.to_active()
        response = self.patch(self.campaign_owner, active, {"scenario": "Ford"})
        self.assertEqual((response.status_code, response.data), (400, status_changed("Only an ended battle's record can be edited", "active")))  # fmt: skip
        battle_id = self.ended()
        for user, status in ((self.player, 403), (self.viewer, 403), (self.outsider, 404)):
            with self.subTest(user=user.username):
                self.assertEqual(self.patch(user, battle_id, {"scenario": "Ford"}).status_code, status)
                self.assertEqual(self.get_as(user, self.url(battle_id, "record")).status_code, status)
        self.assertEqual(self.post_as(self.campaign_owner, self.url(battle_id, "record"), {}).status_code, 405)
        cases: list[tuple[dict[str, Any], str]] = [
            ({"scenario": ""}, "scenario"),
            ({"date": "2999-01-01"}, "date"),
            ({"date": "soon"}, "date"),
            ({"participants": [{"warband_id": self.warband.id}]}, "participants"),
            (
                {"participants": [{"warband_id": self.warband.id}, {"warband_id": self.warband.id + 999}]},
                "participants",
            ),
            ({"winners": [self.warband.id + 999]}, "winners"),
            ({"scenario_link": "x" * 501}, "scenario_link"),
        ]
        for body, field in cases:
            with self.subTest(body=body):
                response = self.patch(self.campaign_owner, battle_id, body)
                self.assertEqual((response.status_code, list(response.data["fields"])), (400, [field]))
        self.assertEqual(self.battle(battle_id).scenario, "Bridge")
