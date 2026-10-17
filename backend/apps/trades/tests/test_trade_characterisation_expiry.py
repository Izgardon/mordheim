"""Characterisation: trade expiry and who may act on a trade (pass 2, step 0; ECON-TEST-09/-10, SEC-08)."""

from apps.campaigns.models import CampaignMembership
from apps.realtime.channel_auth import authorize_private_channel
from apps.trades.models import TradeRequest
from apps.warbands.models import Hero

from .trade_support import TradeTestCase


class TradeExpiryTests(TradeTestCase):
    def _locked_trade_with_trader(self) -> tuple[TradeRequest, Hero]:
        """An open trade whose sender has locked an offer with a trader (so the trader is spent)."""
        trade = self.open_trade()
        hero = self.trader(self.warband)
        self.assertEqual(self.offer(self.player, trade, trader_id=hero.id).status_code, 200)
        self.assertEqual(self.lock(self.player, trade).status_code, 200)
        self.assertFalse(self.trading_action(hero))
        return trade, hero

    def test_reading_an_expired_trade_expires_it_and_gives_the_traders_back(self):
        trade, hero = self._locked_trade_with_trader()
        pending = self.make_trade()
        self.expire(trade)
        self.expire(pending)

        for entry in (trade, pending):
            with self.subTest(status=entry.status):
                response = self.get_as(self.player, self.trade_url(entry))
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["status"], "expired")
                self.assertEqual(self.state(entry), ("expired", False, False))
        self.assertTrue(self.trading_action(hero))

    def test_writes_to_an_expired_open_trade_expire_it_and_give_the_traders_back(self):
        for action in ("offer", "lock", "unlock", "close"):
            with self.subTest(action=action):
                trade, hero = self._locked_trade_with_trader()
                self.expire(trade)

                response = self.post_as(self.viewer, self.trade_url(trade, action))

                self.assertEqual((response.status_code, response.json()), (400, {"detail": "Trade request expired"}))
                self.assertEqual(self.state(trade), ("expired", False, False))
                self.assertTrue(self.trading_action(hero))

    def test_answering_an_expired_request_leaves_its_notification_open(self):
        # Characterises current behaviour (BUG-69, pinned; flips in PR A; ECON-TEST-10)
        for action in ("accept", "decline"):
            with self.subTest(action=action):
                trade = self.request_trade()
                self.expire(trade)

                response = self.post_as(self.viewer, self.trade_url(trade, action))

                self.assertEqual((response.status_code, response.json()), (400, {"detail": "Trade request expired"}))
                self.assertEqual(self.state(trade)[0], "expired")
                self.assertFalse(self.notification(self.viewer, trade).is_resolved)

    def test_the_campaign_list_expires_open_trades_but_not_pending_requests(self):
        # Characterises current behaviour (BUG-69, pinned; flips in PR A): a GET writes; expired open trades
        # are closed and their traders restored, while expired pending requests are listed as pending
        trade, hero = self._locked_trade_with_trader()
        pending = self.make_trade()
        self.expire(trade)
        self.expire(pending)

        response = self.get_as(self.player, self.trades_url())

        self.assertEqual(response.status_code, 200)
        statuses = {row["id"]: row["status"] for row in response.json()}
        self.assertEqual(statuses, {str(trade.id): "expired", str(pending.id): "pending"})
        self.assertEqual(
            (self.state(trade), self.state(pending)), (("expired", False, False), ("pending", False, False))
        )
        self.assertTrue(self.trading_action(hero))

    def test_the_pending_list_expires_old_requests_and_hides_them(self):
        trade = self.request_trade()
        self.expire(trade)

        response = self.get_as(self.viewer, "/api/trade-requests/pending/")

        self.assertEqual((response.status_code, response.json()), (200, []))
        self.assertEqual(self.state(trade)[0], "expired")
        self.assertFalse(self.notification(self.viewer, trade).is_resolved)  # BUG-69: left open here too


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
        self.assertEqual(self.get_as(self.player, "/api/trade-requests/pending/").json(), [])
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
