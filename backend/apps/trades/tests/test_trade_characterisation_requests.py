"""Characterisation: requesting, accepting, declining, closing and listing trades (pass 2, step 0)."""

from datetime import UTC, datetime, timedelta
from typing import Any
from unittest import mock

from apps.notifications.models import Notification
from apps.trades.models import TradeRequest

from .trade_support import PAYLOAD_KEYS, TradeTestCase

FROZEN = datetime(2026, 10, 17, 12, 0, tzinfo=UTC)


class TradeRequestCreateTests(TradeTestCase):
    def test_a_request_starts_pending_for_ten_minutes_and_notifies_the_other_player(self):
        # decision 8: ten minutes to answer (was five)
        with mock.patch("django.utils.timezone.now", return_value=FROZEN):
            response = self.post_as(self.player, self.trades_url(), {"target_user_id": self.viewer.id})

        self.assertEqual(response.status_code, 201)
        body = response.json()
        trade = TradeRequest.objects.get(id=body["id"])
        self.assertEqual(list(body), PAYLOAD_KEYS)
        self.assertEqual(
            body,
            {
                "id": str(trade.id),
                "campaign_id": self.campaign.id,
                "status": "pending",
                "created_at": FROZEN.isoformat(),
                "responded_at": None,
                "expires_at": (FROZEN + timedelta(minutes=10)).isoformat(),
                "from_offer": {},
                "to_offer": {},
                "from_accepted": False,
                "to_accepted": False,
                "offer_version": 0,
                "from_trader_spent_id": None,
                "to_trader_spent_id": None,
                "from_user": {"id": self.player.id, "label": "playe"},
                "to_user": {"id": self.viewer.id, "label": "viewe"},
                "from_warband": {"id": self.warband.id, "name": "Monks"},
                "to_warband": {"id": self.rival.id, "name": "Rats"},
                "channel": f"private-trade-{trade.id}",
            },
        )
        notification = self.notification(self.viewer, trade)
        self.assertEqual(
            (notification.campaign_id, notification.payload, notification.is_resolved), (self.campaign.id, body, False)
        )
        self.user_events.assert_called_once_with(
            self.viewer.id, "trade_request", {**body, "notification_id": notification.id}
        )
        self.trade_events.assert_not_called()

    def test_two_warbands_have_one_open_trade_at_a_time(self):
        # BUG-114: any number of requests could be open between the same two players, each notifying, all
        # sharing one stash, purse and set of traders
        first = self.request_trade()
        self.user_events.reset_mock()
        expected = {
            "detail": "You already have a trade open with this player.",
            "code": "trade_already_open",
            "trade_id": str(first.id),
        }
        for sender, recipient in ((self.player, self.viewer), (self.viewer, self.player)):
            with self.subTest(sender=sender.email):
                response = self.post_as(sender, self.trades_url(), {"target_user_id": recipient.id})
                self.assertEqual((response.status_code, response.json()), (409, expected))
        TradeRequest.objects.filter(id=first.id).update(status="accepted")
        response = self.post_as(self.viewer, self.trades_url(), {"target_user_id": self.player.id})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(TradeRequest.objects.count(), 1)
        self.assertEqual(Notification.objects.filter(notification_type="trade_request").count(), 1)
        self.user_events.assert_not_called()

    def test_a_finished_or_run_out_trade_does_not_stop_a_new_request(self):
        for change in ({"status": "declined"}, {"status": "completed"}, {"expires_at": FROZEN}):
            with self.subTest(change=list(change)):
                previous = self.request_trade()
                TradeRequest.objects.filter(id=previous.id).update(**change)
                self.assertNotEqual(self.request_trade().id, previous.id)
                TradeRequest.objects.update(status="expired")

    def test_invalid_requests(self):
        cases: list[tuple[Any, dict[str, Any], int, str]] = [
            (self.player, {}, 400, "target_user_id is required"),
            (self.player, {"target_user_id": 0}, 400, "target_user_id is required"),
            (self.player, {"target_user_id": "abc"}, 400, "Invalid target_user_id"),
            (self.player, {"target_user_id": self.player.id}, 400, "Cannot trade with yourself"),
            (self.player, {"target_user_id": self.outsider.id}, 404, "Player not found"),
            (self.player, {"target_user_id": self.admin.id}, 400, "Both players need a warband to trade"),
            (self.admin, {"target_user_id": self.viewer.id}, 400, "Both players need a warband to trade"),
            (self.outsider, {"target_user_id": self.viewer.id}, 404, "Not found"),
        ]
        for user, body, status_code, detail in cases:
            with self.subTest(user=user.email, body=body):
                response = self.post_as(user, self.trades_url(), body)
                self.assertEqual((response.status_code, response.json()), (status_code, {"detail": detail}))
        self.assertFalse(TradeRequest.objects.exists())
        self.assertFalse(Notification.objects.exists())
        self.user_events.assert_not_called()


class TradeRequestAnswerTests(TradeTestCase):
    def test_accepting_opens_the_trade_and_resolves_the_notification(self):
        trade = self.request_trade()
        self.user_events.reset_mock()

        response = self.post_as(self.viewer, self.trade_url(trade, "accept"))

        self.assertEqual(response.status_code, 200)
        body = response.json()
        trade.refresh_from_db()
        self.assertEqual((body["status"], trade.status), ("accepted", "accepted"))
        assert trade.responded_at is not None
        self.assertEqual(body["responded_at"], trade.responded_at.isoformat())
        self.assertTrue(self.notification(self.viewer, trade).is_resolved)
        self.trade_events.assert_called_once_with(trade.id, "trade.accepted", body, socket_id=None)
        self.user_events.assert_called_once_with(self.player.id, "trade_accepted", body)

    def test_declining_closes_the_request_and_resolves_the_notification(self):
        trade = self.request_trade()
        self.user_events.reset_mock()

        response = self.post_as(self.viewer, self.trade_url(trade, "decline"))

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual((body["status"], self.state(trade)), ("declined", ("declined", False, False)))
        self.assertTrue(self.notification(self.viewer, trade).is_resolved)
        self.user_events.assert_called_once_with(self.player.id, "trade_declined", body)
        self.trade_events.assert_not_called()

    def test_only_the_recipient_may_accept_or_decline(self):
        trade = self.request_trade()
        for user in (self.player, self.admin, self.outsider):
            for action in ("accept", "decline"):
                with self.subTest(user=user.email, action=action):
                    response = self.post_as(user, self.trade_url(trade, action))
                    self.assertEqual((response.status_code, response.json()), (403, {"detail": "Forbidden"}))
        self.assertEqual(self.state(trade), ("pending", False, False))

    def test_a_request_that_is_no_longer_pending_cannot_be_answered(self):
        for status in ("accepted", "declined", "completed"):
            trade = self.make_trade(status)
            for action in ("accept", "decline"):
                with self.subTest(status=status, action=action):
                    response = self.post_as(self.viewer, self.trade_url(trade, action))
                    self.assertEqual(
                        (response.status_code, response.json()),
                        (400, {"detail": "Trade request is no longer pending"}),
                    )
                    self.assertEqual(self.state(trade)[0], status)


class TradeRequestCloseTests(TradeTestCase):
    def test_either_player_can_close_a_pending_request(self):
        # BUG-115: the sender's close used to be stored as "declined", as if the recipient had declined
        for user, closed in ((self.player, "cancelled"), (self.viewer, "declined")):
            with self.subTest(user=user.email):
                trade = self.request_trade()
                self.trade_events.reset_mock()

                response = self.post_as(user, self.trade_url(trade, "close"))

                self.assertEqual(response.status_code, 200)
                body = response.json()
                self.assertEqual((body["status"], self.state(trade)), (closed, (closed, False, False)))
                self.trade_events.assert_called_once_with(trade.id, "trade.closed", body, socket_id=None)

    def test_closing_a_pending_request_resolves_the_recipients_notification(self):
        # BUG-69: the recipient's notification used to stay open after the sender closed the request
        trade = self.request_trade()

        self.assertEqual(self.post_as(self.player, self.trade_url(trade, "close")).status_code, 200)

        self.assertTrue(self.notification(self.viewer, trade).is_resolved)

    def test_closing_an_open_trade_unlocks_both_sides_and_leaves_trading_actions_untouched(self):
        # decision 9 (simplified): the lock no longer spends the trader, so closing has nothing to give back
        trade = self.open_trade()
        hero = self.trader(self.warband)
        self.assertEqual(self.offer(self.player, trade, trader_id=hero.id).status_code, 200)
        self.assertEqual(self.lock(self.player, trade).status_code, 200)
        self.assertTrue(self.trading_action(hero))

        response = self.post_as(self.viewer, self.trade_url(trade, "close"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.state(trade), ("declined", False, False))
        self.assertTrue(self.trading_action(hero))

    def test_a_finished_request_cannot_be_closed(self):
        for status in ("declined", "expired", "completed", "cancelled"):
            with self.subTest(status=status):
                trade = self.request_trade()
                TradeRequest.objects.filter(id=trade.id).update(status=status)
                response = self.post_as(self.player, self.trade_url(trade, "close"))
                self.assertEqual(
                    (response.status_code, response.json()), (400, {"detail": "Trade request is no longer active"})
                )
                self.assertEqual(self.state(trade)[0], status)


class TradeRequestReadTests(TradeTestCase):
    def test_players_list_their_own_trades_in_the_campaign_unanswered_first(self):
        older, newer, answered = self.make_trade(), self.make_trade(), self.make_trade()
        start = datetime(2026, 10, 1, tzinfo=UTC)
        TradeRequest.objects.filter(id=older.id).update(created_at=start)
        TradeRequest.objects.filter(id=newer.id).update(created_at=start + timedelta(minutes=1))
        TradeRequest.objects.filter(id=answered.id).update(status="declined", responded_at=start)

        for user in (self.player, self.viewer):
            with self.subTest(user=user.email):
                response = self.get_as(user, self.trades_url())
                self.assertEqual(response.status_code, 200)
                # "-responded_at" puts NULLs (never answered) first on Postgres
                self.assertEqual(
                    [row["id"] for row in response.json()], [str(newer.id), str(older.id), str(answered.id)]
                )
                self.assertEqual(list(response.json()[0]), PAYLOAD_KEYS)
        # BUG-116: every member used to list every trade, offers included, though the detail view answers 404
        for user in (self.campaign_owner, self.admin, self.manager):
            with self.subTest(user=user.email):
                self.assertEqual(self.get_as(user, self.trades_url()).json(), [])

    def test_the_list_filters_by_status(self):
        pending = self.make_trade()
        self.make_trade("declined")

        cancelled = self.make_trade("cancelled")
        listed = self.get_as(self.player, f"{self.trades_url()}?status=cancelled")
        self.assertEqual([row["id"] for row in listed.json()], [str(cancelled.id)])
        response = self.get_as(self.player, f"{self.trades_url()}?status=pending")
        invalid = self.get_as(self.player, f"{self.trades_url()}?status=open")
        outsider = self.get_as(self.outsider, self.trades_url())

        self.assertEqual([row["id"] for row in response.json()], [str(pending.id)])
        self.assertEqual((invalid.status_code, invalid.json()), (400, {"detail": "Invalid status"}))
        self.assertEqual((outsider.status_code, outsider.json()), (404, {"detail": "Not found"}))

    def test_only_the_two_players_can_read_a_trade(self):
        trade = self.request_trade()
        for user in (self.player, self.viewer):
            with self.subTest(user=user.email):
                response = self.get_as(user, self.trade_url(trade))
                self.assertEqual(response.status_code, 200)
                self.assertEqual(list(response.json()), PAYLOAD_KEYS)
        for user in (self.admin, self.outsider):
            with self.subTest(user=user.email):
                response = self.get_as(user, self.trade_url(trade))
                self.assertEqual((response.status_code, response.json()), (404, {"detail": "Not found"}))
        other_campaign = self.foreign_race.campaign_id
        response = self.get_as(self.player, self.trade_url(trade, campaign_id=other_campaign))
        self.assertEqual(response.status_code, 404)

    def test_the_unused_pending_list_is_gone(self):
        # BUG-69 (decision 8): GET /trade-requests/pending/ expired requests as it read them and no client called
        # it; a player's waiting requests are their unresolved trade_request notifications
        self.request_trade()

        response = self.get_as(self.viewer, "/api/trade-requests/pending/")

        self.assertEqual(response.status_code, 404)
