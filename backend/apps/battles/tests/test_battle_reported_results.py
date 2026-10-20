"""Reported results waiting for answers: the campaign's pending list and the submitter's withdraw (BUG-46).

BATL-TEST-15: `GET campaigns/:id/battles/pending-results/` costs the same for one result as for many.
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.battles.models import BattleEvent
from apps.notifications.models import Notification
from apps.warbands.models import Warband

from .battle_support import BattleTestCase, status_changed


class PendingResultsTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.crows = Warband.objects.create(campaign=self.campaign, user=self.manager, name="Crows", faction="X")

    def report(self, by: Any = None, **overrides: Any) -> int:
        by = by or self.player
        opponent = self.viewer if by is not self.viewer else self.player
        body = {"participant_user_ids": [opponent.id], "scenario": "Street Brawl", "battle_date": "2026-10-01"}
        body |= {"winner_warband_ids": [self.warband.id]} | overrides
        response = self.ok(self.post_as(by, f"{self.battles_url()}report-result/", body), 201)
        return int(response.data["battle"]["id"])

    def pending_url(self) -> str:
        return f"{self.battles_url()}pending-results/"

    def test_pending_results_list_what_waits_for_an_answer(self):
        mine = self.report()
        theirs = self.report(by=self.viewer, winner_warband_ids=[self.rival.id])
        answered = self.report()
        self.ok(self.post_as(self.viewer, self.url(answered, "approve-result")))

        data = self.ok(self.get_as(self.viewer, self.pending_url())).data

        self.assertEqual([entry["battle_id"] for entry in data], [theirs, mine])
        entry = data[1]
        self.assertEqual(
            {key: entry[key] for key in ("scenario", "battle_date", "winner_warband_names", "created_by_user_label")},
            {"scenario": "Street Brawl", "battle_date": "2026-10-01", "winner_warband_names": ["Monks"], "created_by_user_label": "playe"},
        )  # fmt: skip
        self.assertEqual((entry["awaiting_my_answer"], entry["can_withdraw"]), (True, False))
        self.assertEqual((data[0]["awaiting_my_answer"], data[0]["can_withdraw"]), (False, True))
        self.assertEqual(
            [(p["user_label"], p["warband_name"], p["status"]) for p in entry["participants"]],
            [("playe", "Monks", "reported_result_approved"), ("viewe", "Rats", "reported_result_pending")],
        )
        self.assertEqual(self.get_as(self.outsider, self.pending_url()).status_code, 404)
        self.assertEqual(self.ok(self.get_as(self.manager, self.pending_url())).data, [])  # not his battles

    def test_pending_results_cost_the_same_for_one_or_many(self):
        # BATL-TEST-15: membership, the battles with their creators, their participants
        self.report()

        def count() -> int:
            self.client.force_authenticate(user=self.viewer)
            with CaptureQueriesContext(connection) as captured:
                self.ok(self.client.get(self.pending_url()))
            return len(captured)

        one = count()
        for _ in range(3):
            self.report()
        self.assertEqual((one, count()), (3, 3))


class WithdrawResultTests(BattleTestCase):
    def report(self) -> int:
        body = {"participant_user_ids": [self.viewer.id], "scenario": "Street Brawl", "battle_date": "2026-10-01"}
        body |= {"winner_warband_ids": [self.warband.id]}
        return int(self.ok(self.post_as(self.player, f"{self.battles_url()}report-result/", body), 201).data["battle"]["id"])  # fmt: skip

    def test_the_submitter_withdraws_a_pending_result(self):
        battle_id = self.report()
        url = self.url(battle_id, "withdraw-result")
        response = self.post_as(self.viewer, url)
        self.assertEqual((response.status_code, response.data["code"]), (403, "not_submitter"))

        data = self.ok(self.post_as(self.player, url)).data

        self.assertEqual(data["battle"]["status"], "canceled")
        self.assertEqual(self.statuses(battle_id), ["reported_result_declined", "reported_result_declined"])
        event = BattleEvent.objects.filter(battle_id=battle_id).last()
        assert event is not None
        self.assertEqual((event.type, event.payload_json), ("battle_canceled", {"canceled_by_user_id": self.player.id, "mode": "withdrawn"}))  # fmt: skip
        self.assertFalse(Notification.objects.filter(reference_id=str(battle_id), is_resolved=False).exists())
        self.assertIn((self.viewer.id, "battle_result_updated"), self.notified())
        self.assertEqual((self.record(self.warband), self.record(self.rival)), ((None, None), (None, None)))
        self.assertEqual(self.ok(self.post_as(self.player, url)).data["events"], [])  # again: nothing new

    def test_withdraw_needs_a_pending_reported_result(self):
        battle_id = self.report()
        self.ok(self.post_as(self.viewer, self.url(battle_id, "approve-result")))
        response = self.post_as(self.player, self.url(battle_id, "withdraw-result"))
        detail = "Reported result has already been committed"
        self.assertEqual((response.status_code, response.data), (400, status_changed(detail, "ended")))

        normal = self.create_battle()
        response = self.post_as(self.player, self.url(normal, "withdraw-result"))
        detail = "This battle is not a reported result"
        self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))
        self.assertEqual(self.post_as(self.outsider, self.url(normal, "withdraw-result")).status_code, 404)
