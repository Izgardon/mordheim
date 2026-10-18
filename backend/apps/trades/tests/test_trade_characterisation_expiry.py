"""Characterisation: trade expiry and who may act on a trade (pass 2, step 0; ECON-TEST-09/-10, SEC-08)."""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.campaigns.models import CampaignMembership
from apps.realtime.channel_auth import authorize_private_channel
from apps.trades.models import TradeRequest
from apps.warbands.models import Hero

from .trade_support import TradeTestCase


def writes(captured: Any) -> list[str]:
    """The UPDATE, INSERT and DELETE statements a request ran."""
    return [query["sql"] for query in captured if query["sql"].lstrip().split()[0] in ("UPDATE", "INSERT", "DELETE")]


class TradeExpiryTests(TradeTestCase):
    def _locked_trade_with_trader(self) -> tuple[TradeRequest, Hero]:
        """An open trade whose sender has locked an offer with a trader (who keeps his trading action)."""
        trade = self.open_trade()
        hero = self.trader(self.warband)
        self.assertEqual(self.offer(self.player, trade, trader_id=hero.id).status_code, 200)
        self.assertEqual(self.lock(self.player, trade).status_code, 200)
        self.assertTrue(self.trading_action(hero))
        return trade, hero

    def test_reading_a_trade_that_ran_out_shows_it_expired_and_writes_nothing(self):
        # BUG-69 (decision 8): reading used to expire the trade and give its traders back; reads no longer write
        # (the next write closes it; there is nothing to give back), but the payload already says "expired"
        trade, hero = self._locked_trade_with_trader()
        pending = self.make_trade(from_user=self.viewer, to_user=self.player)
        self.expire(trade)
        self.expire(pending)

        for entry, stored in ((trade, ("accepted", True, False)), (pending, ("pending", False, False))):
            with self.subTest(status=entry.status):
                with CaptureQueriesContext(connection) as captured:
                    response = self.get_as(self.player, self.trade_url(entry))
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["status"], "expired")
                self.assertEqual(self.state(entry), stored)
                self.assertEqual(writes(captured), [])
        self.assertTrue(self.trading_action(hero))

    def test_writes_to_an_expired_open_trade_expire_it_and_leave_trading_actions_untouched(self):
        for action in ("offer", "lock", "unlock", "close"):
            with self.subTest(action=action):
                trade, hero = self._locked_trade_with_trader()
                self.expire(trade)

                response = self.post_as(self.viewer, self.trade_url(trade, action))

                self.assertEqual((response.status_code, response.json()), (400, {"detail": "Trade request expired"}))
                self.assertEqual(self.state(trade), ("expired", False, False))
                self.assertTrue(self.trading_action(hero))

    def test_answering_an_expired_request_resolves_its_notification(self):
        # BUG-69, ECON-TEST-10: answering after expiry used to leave the recipient's notification open
        for action in ("accept", "decline"):
            with self.subTest(action=action):
                trade = self.request_trade()
                self.expire(trade)

                response = self.post_as(self.viewer, self.trade_url(trade, action))

                self.assertEqual((response.status_code, response.json()), (400, {"detail": "Trade request expired"}))
                self.assertEqual(self.state(trade)[0], "expired")
                self.assertTrue(self.notification(self.viewer, trade).is_resolved)

    def test_the_campaign_list_shows_trades_that_ran_out_as_expired_and_writes_nothing(self):
        # BUG-69 (decision 8): the list GET used to expire open trades (giving traders back) and list run-out
        # pending requests as pending; it now writes nothing and shows both as expired, also under ?status=
        trade, hero = self._locked_trade_with_trader()
        pending = self.make_trade(from_user=self.viewer, to_user=self.player)
        live = self.make_trade(from_user=self.viewer, to_user=self.player)
        self.expire(trade)
        self.expire(pending)

        with CaptureQueriesContext(connection) as captured:
            response = self.get_as(self.player, self.trades_url())

        self.assertEqual(response.status_code, 200)
        statuses = {row["id"]: row["status"] for row in response.json()}
        self.assertEqual(statuses, {str(trade.id): "expired", str(pending.id): "expired", str(live.id): "pending"})
        self.assertEqual(writes(captured), [])
        self.assertEqual(
            (self.state(trade), self.state(pending)), (("accepted", True, False), ("pending", False, False))
        )
        for status, expected in (("expired", {trade.id, pending.id}), ("pending", {live.id}), ("accepted", set())):
            with self.subTest(status=status):
                listed = self.get_as(self.player, f"{self.trades_url()}?status={status}").json()
                self.assertEqual({row["id"] for row in listed}, {str(trade_id) for trade_id in expected})
        self.assertTrue(self.trading_action(hero))  # nothing spent: only completion spends a trader


class TradeAccessTests(TradeTestCase):
    def test_only_the_two_players_may_change_a_trade(self):
        trade = self.open_trade()
        for user in (self.campaign_owner, self.admin, self.manager, self.outsider):
            for action in ("offer", "lock", "unlock", "close", "accept", "decline"):
                with self.subTest(user=user.email, action=action):
                    response = self.post_as(user, self.trade_url(trade, action), {"gold": 0})
                    self.assertEqual((response.status_code, response.json()), (403, {"detail": "Forbidden"}))
        self.assertEqual(self.state(trade), ("accepted", False, False))
        self.assertEqual((trade.from_offer, trade.to_offer), ({}, {}))

    def test_unknown_trades_and_anonymous_users(self):
        trade = self.open_trade()
        missing = TradeRequest(id="00000000-0000-0000-0000-000000000000")
        other_campaign = self.foreign_race.campaign_id
        for action in ("offer", "lock", "unlock", "close", "accept", "decline"):
            with self.subTest(action=action):
                for url in (self.trade_url(missing, action), self.trade_url(trade, action, campaign_id=other_campaign)):
                    response = self.post_as(self.player, url)
                    self.assertEqual((response.status_code, response.json()), (404, {"detail": "Not found"}))
                self.client.force_authenticate(user=None)
                self.assertEqual(self.client.post(self.trade_url(trade, action)).status_code, 401)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.trades_url()).status_code, 401)

    def test_a_player_removed_from_the_campaign_can_no_longer_trade(self):
        # SEC-08 (trade half): participants used to be checked by user id only, in the views and in the trade
        # channel's auth, so a player removed from the campaign kept trading. They now get 404, like the
        # campaign's other endpoints, and the trade channel admits nobody while one of them is gone.
        self.stash(self.rival, self.axe, 1, cost=5)
        trade = self.open_trade()
        self.assertEqual(self.offer(self.viewer, trade, items=[{"id": self.axe.id, "quantity": 1}]).status_code, 200)
        CampaignMembership.objects.filter(campaign=self.campaign, user=self.viewer).delete()

        for action in ("offer", "lock", "unlock", "close"):
            with self.subTest(action=action):
                response = self.post_as(self.viewer, self.trade_url(trade, action))
                self.assertEqual((response.status_code, response.json()), (404, {"detail": "Not found"}))
        self.assertEqual(self.get_as(self.viewer, self.trade_url(trade)).status_code, 404)
        channel = f"private-trade-{trade.id}"
        self.assertEqual(
            [authorize_private_channel(user, channel) for user in (self.viewer, self.player)], [False, False]
        )

        # the player still in the campaign can't move the trade on, but can back out of it
        for action in ("offer", "lock"):
            with self.subTest(partner_action=action):
                response = self.post_as(self.player, self.trade_url(trade, action))
                self.assertEqual(
                    (response.status_code, response.json()),
                    (409, {"detail": "The other player is no longer in this campaign.", "code": "trade_partner_left"}),
                )
        self.assertEqual(self.state(trade), ("accepted", False, False))
        self.assertEqual(self.post_as(self.player, self.trade_url(trade, "close")).status_code, 200)
        self.assertEqual(self.stash_rows(self.warband), [])

        # Campaign-level endpoints do check membership
        self.assertEqual(self.get_as(self.viewer, self.trades_url()).status_code, 404)
        response = self.post_as(self.viewer, self.trades_url(), {"target_user_id": self.player.id})
        self.assertEqual(response.status_code, 404)

    def test_a_request_from_or_to_a_player_who_left_the_campaign(self):
        to_viewer = self.request_trade()
        CampaignMembership.objects.filter(campaign=self.campaign, user=self.player).delete()

        accept = self.post_as(self.viewer, self.trade_url(to_viewer, "accept"))
        self.assertEqual((accept.status_code, accept.json()["code"]), (409, "trade_partner_left"))
        self.assertEqual(self.post_as(self.viewer, self.trade_url(to_viewer, "decline")).status_code, 200)

    def test_the_trade_channel_admits_the_two_players_while_the_trade_is_live(self):
        trade = self.open_trade()
        channel = f"private-trade-{trade.id}"
        self.assertEqual(
            [authorize_private_channel(user, channel) for user in (self.player, self.viewer, self.admin)],
            [True, True, False],
        )
        self.expire(trade)
        self.assertFalse(authorize_private_channel(self.player, channel))
        for status in ("completed", "cancelled"):
            finished = self.make_trade(status)
            self.assertFalse(authorize_private_channel(self.player, f"private-trade-{finished.id}"))
