"""Who may trade for a warband: its owner only (decision 10).

The sheet reports it as `capabilities.trade`, and every trade write checks that the player acting for a side
owns that side's warband: campaign owners, admins and managers may edit a warband but never trade for it.
"""

from datetime import timedelta

from django.utils import timezone

from apps.trades.models import TradeRequest

from .trade_support import TradeTestCase

ACTIONS = ("offer", "lock", "unlock", "close", "accept", "decline")


class TradePermissionTests(TradeTestCase):
    def sheet_can_trade(self, user, warband) -> bool:
        return bool(self.get_as(user, f"/api/warbands/{warband.id}/sheet/").json()["capabilities"]["trade"])

    def test_the_sheet_says_only_the_owner_may_trade(self):
        for user, expected in (
            (self.player, True),
            (self.campaign_owner, False),
            (self.admin, False),
            (self.manager, False),
            (self.viewer, False),
        ):
            with self.subTest(user=user.email):
                self.assertEqual(self.sheet_can_trade(user, self.warband), expected)
        self.assertTrue(self.sheet_can_trade(self.viewer, self.rival))

    def test_the_flag_agrees_with_the_server(self):
        # the owner can start a trade for his warband; someone who may only edit it has none to trade from
        self.assertEqual(
            self.post_as(self.player, self.trades_url(), {"target_user_id": self.viewer.id}).status_code, 201
        )
        for user in (self.campaign_owner, self.admin, self.manager):
            with self.subTest(user=user.email):
                response = self.post_as(user, self.trades_url(), {"target_user_id": self.viewer.id})
                self.assertEqual(response.json(), {"detail": "Both players need a warband to trade"})

    def test_a_player_named_on_a_trade_cannot_act_for_a_warband_he_does_not_own(self):
        # a row whose recipient is not the owner of the receiving warband: only that warband's owner may act for
        # it, and he isn't a party to this trade either
        trade = TradeRequest.objects.create(
            campaign=self.campaign,
            from_user=self.player,
            to_user=self.campaign_owner,
            from_warband=self.warband,
            to_warband=self.rival,  # the viewer's warband
            status=TradeRequest.STATUS_ACCEPTED,
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        for user in (self.campaign_owner, self.viewer):
            for action in ACTIONS:
                with self.subTest(user=user.email, action=action):
                    response = self.post_as(user, self.trade_url(trade, action), {"gold": 0})
                    self.assertEqual((response.status_code, response.json()), (403, {"detail": "Forbidden"}))
            self.assertEqual(self.get_as(user, self.trade_url(trade)).status_code, 404)
        self.assertEqual(self.state(trade), ("accepted", False, False))
        self.assertEqual(self.get_as(self.player, self.trade_url(trade)).status_code, 200)  # the sender owns his
