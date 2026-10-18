"""Ending a battle characterised: End battle, cancels, skipping postbattle and the trading reset (pass 3, step 0).

Pinned: wins and losses added at End and a postbattle cancel rewriting confirmed rows (BUG-09, BATL-TEST-03/04),
a cancelled participant blocking start (BUG-45). Fixed: the trading actions reset once, at End (BUG-122); a skip
uses up the items used in battle (BUG-72; test_battle_item_use.py); End needing a winner is decision 8's and creator-only End decision 4's.
"""

from collections.abc import Callable
from decimal import Decimal
from typing import Any

from apps.battles.models import Battle, BattleEvent
from apps.notifications.models import Notification
from apps.warbands.models import Hero

from .battle_support import BattleTestCase, draft, unit_result


class BattleFinishTests(BattleTestCase):
    def test_end_needs_the_creator_and_a_winner_from_the_battle(self):
        # Characterises current behaviour (decision 8, pinned; flips in PR A: an empty list is "No winner")
        battle_id = self.to_active()
        url = self.url(battle_id, "finish")
        cases = [
            ([], "winner_warband_ids must be a non-empty list"),
            ("x", "winner_warband_ids must be a non-empty list"),
            (["x"], "winner_warband_ids must contain integers"),
            ([0], "winner_warband_ids must contain integers"),
            ([self.warband.id + 999], "winner_warband_ids must belong to this battle"),
        ]
        for winners, detail in cases:
            with self.subTest(winners=winners):
                response = self.post_as(self.player, url, {"winner_warband_ids": winners})
                self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))
        # decision 4 (pinned; flips in PR C): the battle ends when the last player finishes, with no End button
        response = self.post_as(self.viewer, url, {"winner_warband_ids": [self.rival.id]})
        detail = "Only the battle creator can end the active battle"
        self.assertEqual((response.status_code, response.data), (403, {"detail": detail}))
        self.assertEqual(self.battle(battle_id).status, "active")

    def test_end_before_the_battle_starts(self):
        battle_id = self.to_prebattle()
        response = self.post_as(self.player, self.url(battle_id, "finish"), {"winner_warband_ids": [self.warband.id]})
        self.assertEqual((response.status_code, response.data), (400, {"detail": "Battle has not started"}))

    def test_wins_and_losses_are_added_when_the_battle_is_ended(self):
        # Characterises current behaviour (BUG-09, pinned; flips in PR A: added once, when the battle finishes)
        battle_id = self.to_active()

        data = self.ok(
            self.post_as(
                self.player, self.url(battle_id, "finish"), {"winner_warband_ids": [self.warband.id, self.warband.id]}
            )
        ).data

        self.assertEqual((self.record(self.warband), self.record(self.rival)), ((1, None), (None, 1)))
        self.assertEqual(
            (data["battle"]["status"], data["battle"]["winner_warband_ids_json"]), ("postbattle", [self.warband.id])
        )
        self.assertEqual(self.statuses(battle_id), ["finished_battle", "finished_battle"])
        self.assertEqual([event["type"] for event in data["events"]], ["battle_entered_postbattle"])
        self.assertEqual(data["events"][0]["payload_json"], {"winner_warband_ids": [self.warband.id]})

        again = self.ok(self.finish(battle_id, [self.rival])).data  # a second End is ignored
        self.assertEqual((again["events"], again["battle"]["winner_warband_ids_json"]), ([], [self.warband.id]))
        self.assertEqual((self.record(self.warband), self.record(self.rival)), ((1, None), (None, 1)))

    def test_trading_actions_reset_once_at_end(self):
        # BUG-122: they were reset again when the last player finalised, giving back an action spent in between
        hero = Hero.objects.create(warband=self.warband, name="Haggler", unit_type="Champion", trading_action=False)
        battle_id = self.to_active()

        self.finish(battle_id, [self.warband])
        hero.refresh_from_db()
        self.assertTrue(hero.trading_action)

        Hero.objects.filter(id=hero.id).update(trading_action=False)  # he trades while the other side finishes
        self.ok(self.finalize(self.player, battle_id, draft({})))
        hero.refresh_from_db()
        self.assertFalse(hero.trading_action)
        self.ok(self.finalize(self.viewer, battle_id, draft({})))
        hero.refresh_from_db()
        self.assertFalse(hero.trading_action)  # still spent
        self.assertEqual(self.battle(battle_id).status, "ended")
        self.assertEqual(self.event_types(battle_id)[-2:], ["participant_confirmed_postbattle", "battle_ended"])


class BattleCancelTests(BattleTestCase):
    def _battle_in(self, phase: str) -> int:
        phases: dict[str, Callable[[], int]] = {
            "inviting": self.create_battle,
            "prebattle": self.to_prebattle,
            "active": self.to_active,
            "postbattle": self.to_postbattle,
        }
        return phases[phase]()

    def _assert_cancelled(self, battle_id: int, by: Any, mode: str) -> None:
        self.assertEqual(self.battle(battle_id).status, "canceled")
        self.assertEqual(self.statuses(battle_id), ["canceled_prebattle", "canceled_prebattle"])
        event = BattleEvent.objects.filter(battle_id=battle_id).last()
        assert event is not None
        expected = ("battle_canceled", {"canceled_by_user_id": by.id, "mode": mode})
        self.assertEqual((event.type, event.payload_json), expected)
        self.assertFalse(Notification.objects.filter(reference_id=str(battle_id), is_resolved=False).exists())

    def test_the_creator_cancels_in_every_phase_until_the_battle_ends(self):
        for phase in ("inviting", "prebattle", "active", "postbattle"):
            with self.subTest(phase=phase):
                battle_id = self._battle_in(phase)
                url = self.url(battle_id, "cancel-battle")
                response = self.post_as(self.viewer, url)
                detail = "Only the battle creator can cancel this battle"
                self.assertEqual((response.status_code, response.data), (403, {"detail": detail}))
                self.ok(self.post_as(self.player, url))
                self._assert_cancelled(battle_id, self.player, "creator")
                events = self.event_types(battle_id)
                self.assertEqual(self.ok(self.post_as(self.player, url)).data["events"], [])  # again: nothing new
                self.assertEqual(self.event_types(battle_id), events)
        Battle.objects.filter(id=battle_id).update(status=Battle.STATUS_ENDED)
        response = self.post_as(self.player, self.url(battle_id, "cancel-battle"))
        self.assertEqual((response.status_code, response.data), (400, {"detail": "Battle is already ended"}))

    def test_the_campaign_owner_cancels_in_every_phase_until_the_battle_ends(self):
        def owner_url(battle_id: int) -> str:
            return f"/api/campaigns/{self.campaign.id}/active-battles/{battle_id}/cancel/"

        for phase in ("inviting", "prebattle", "active", "postbattle"):
            with self.subTest(phase=phase):
                battle_id = self._battle_in(phase)
                self.assertEqual(self.post_as(self.player, owner_url(battle_id)).status_code, 403)
                self.assertEqual(self.post_as(self.outsider, owner_url(battle_id)).status_code, 404)
                self.ok(self.post_as(self.campaign_owner, owner_url(battle_id)))
                self._assert_cancelled(battle_id, self.campaign_owner, "campaign_owner")
        self.assertEqual(self.post_as(self.campaign_owner, owner_url(battle_id + 99)).status_code, 404)
        Battle.objects.filter(id=battle_id).update(status=Battle.STATUS_ENDED)
        response = self.post_as(self.campaign_owner, owner_url(battle_id))
        self.assertEqual((response.status_code, response.data), (400, {"detail": "Battle is already ended"}))

    def _finalised_then_cancelled(self, cancel_as: Any, url: str) -> tuple[int, Hero]:
        hero = Hero.objects.create(warband=self.warband, name="Abbess", unit_type="Matriarch")
        battle_id = self.to_postbattle({self.player: [f"hero:{hero.id}"], self.viewer: []})
        self.ok(self.finalize(self.player, battle_id, draft({f"hero:{hero.id}": unit_result(f"hero:{hero.id}", xp=3)})))
        self.assertEqual(self.statuses(battle_id), ["confirmed_postbattle", "finished_battle"])

        self.ok(self.post_as(cancel_as, url.format(battle=battle_id)))
        hero.refresh_from_db()
        return battle_id, hero

    def test_a_creator_cancel_in_postbattle_rewrites_confirmed_rows_and_keeps_results(self):
        # Characterises current behaviour (BUG-09, BATL-TEST-03, pinned; flips in PR A: cancel refuses postbattle)
        url = f"{self.battles_url()}{{battle}}/cancel-battle/"
        battle_id, hero = self._finalised_then_cancelled(self.player, url)

        self.assertEqual(self.statuses(battle_id), ["canceled_prebattle", "canceled_prebattle"])
        self.assertEqual(hero.xp, Decimal(3))
        self.assertEqual((self.record(self.warband), self.record(self.rival)), ((1, None), (None, 1)))

    def test_an_owner_cancel_in_postbattle_rewrites_confirmed_rows_and_keeps_results(self):
        # Characterises current behaviour (BUG-09, BATL-TEST-04, pinned; flips in PR A: cancel refuses postbattle)
        url = f"/api/campaigns/{self.campaign.id}/active-battles/{{battle}}/cancel/"
        battle_id, hero = self._finalised_then_cancelled(self.campaign_owner, url)

        self.assertEqual(self.statuses(battle_id), ["canceled_prebattle", "canceled_prebattle"])
        self.assertEqual(hero.xp, Decimal(3))
        self.assertEqual((self.record(self.warband), self.record(self.rival)), ((1, None), (None, 1)))

    def test_a_cancelled_participant_blocks_start_for_ever(self):
        # Characterises current behaviour (BUG-45, pinned; flips in PR A: declined and cancelled rows are ignored)
        battle_id = self.to_prebattle()
        self.ok(self.post_as(self.viewer, self.url(battle_id, "cancel")))
        self.assertEqual(
            (self.battle(battle_id).status, self.statuses(battle_id)),
            ("prebattle", ["joined_prebattle", "canceled_prebattle"]),
        )
        self.assertEqual(self.battle_events.call_args.args[2]["reason"], "participant_canceled_prebattle")

        self.ok(self.post_as(self.player, self.url(battle_id, "ready"), {"ready": True}))
        response = self.post_as(self.player, self.url(battle_id, "start"))
        detail = "All participants must be ready before starting"
        self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))

        self.ok(self.post_as(self.player, self.url(battle_id, "cancel")))  # the last one out cancels the battle
        self.assertEqual(self.battle(battle_id).status, "canceled")
        last = BattleEvent.objects.filter(battle_id=battle_id).last()
        assert last is not None
        self.assertEqual((last.type, last.payload_json), ("battle_canceled", {}))

    def test_an_invitee_who_cancels_leaves_the_battle_inviting(self):
        # BUG-45: there is no decline; the invite stays open and the battle can never reach prebattle
        battle_id = self.create_battle()
        self.ok(self.post_as(self.viewer, self.url(battle_id, "cancel")))

        self.assertEqual(
            (self.battle(battle_id).status, self.statuses(battle_id)), ("inviting", ["accepted", "canceled_prebattle"])
        )
        invite = Notification.objects.get(user=self.viewer, reference_id=str(battle_id))
        self.assertFalse(invite.is_resolved)

    def test_participants_cannot_cancel_once_the_battle_starts(self):
        battle_id = self.to_active()
        for battle_status, detail in (
            (Battle.STATUS_ACTIVE, "Cannot cancel during or after battle"),
            (Battle.STATUS_POSTBATTLE, "Cannot cancel during or after battle"),
            (Battle.STATUS_ENDED, "Cannot cancel during or after battle"),
            (Battle.STATUS_CANCELED, "Battle is already canceled"),
        ):
            with self.subTest(status=battle_status):
                Battle.objects.filter(id=battle_id).update(status=battle_status)
                response = self.post_as(self.viewer, self.url(battle_id, "cancel"))
                self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))


class BattleSkipTests(BattleTestCase):
    def test_skip_and_finalise_outside_postbattle(self):
        battle_id = self.to_active()
        for action in ("confirm", "finalize-postbattle"):
            with self.subTest(action=action):
                response = self.post_as(self.viewer, self.url(battle_id, action))
                self.assertEqual(
                    (response.status_code, response.data), (400, {"detail": "Battle is not in postbattle"})
                )
        Battle.objects.filter(id=battle_id).update(status=Battle.STATUS_CANCELED)
        for action in ("confirm", "finalize-postbattle"):
            with self.subTest(action=action, status="canceled"):
                response = self.post_as(self.viewer, self.url(battle_id, action))
                self.assertEqual((response.status_code, response.data), (400, {"detail": "Battle was canceled"}))

    def test_a_skip_or_finalise_after_finishing_changes_nothing(self):
        battle_id = self.to_postbattle()
        self.ok(self.post_as(self.player, self.url(battle_id, "confirm")))
        events = self.event_types(battle_id)
        for action in ("confirm", "finalize-postbattle"):
            with self.subTest(action=action):
                self.assertEqual(self.ok(self.post_as(self.player, self.url(battle_id, action))).data["events"], [])
        self.assertEqual(self.event_types(battle_id), events)
