"""Concurrency: two trade writes at once (pass 2, step 0; ECON-TEST-06, BUG-08).

Each test runs two real requests on two threads (two database connections) and holds both at a
`Rendezvous` patched in between the view's read of the trade request and its write, so both read before
either writes. Today the views load the request unlocked and save both sides' fields, so one write is
lost: these are expected failures, and PR A (select_for_update, each write saving only its own side)
flips them. If PR A renames the patched helper, move the rendezvous to the new read-to-write gap.
"""

import unittest
from datetime import timedelta
from typing import Any
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.campaigns.models import Campaign, CampaignMembership, CampaignRole
from apps.core.testing import Rendezvous, run_concurrently
from apps.items.models import Item
from apps.trades import views as trade_views
from apps.trades.models import TradeRequest
from apps.warbands.models import Warband, WarbandItem
from apps.warbands.utils.trades import TradeHelper


@override_settings(RATE_LIMIT_ENABLED=False)
class TradeConcurrencyTests(TransactionTestCase):
    def setUp(self) -> None:
        role = CampaignRole.objects.get_or_create(slug="player", defaults={"name": "Player"})[0]
        campaign = Campaign.objects.create(name="Shards", join_code="RACE01")
        users = [
            get_user_model().objects.create_user(username=email, email=email, password=None)
            for email in ("player@example.com", "viewer@example.com")
        ]
        self.player, self.viewer = users
        warbands = []
        for user, name in zip(users, ("Monks", "Rats"), strict=True):
            CampaignMembership.objects.create(campaign=campaign, user=user, role=role)
            warband = Warband.objects.create(campaign=campaign, user=user, name=name, faction="Any")
            TradeHelper.create_trade(warband=warband, action="Reward", description="Purse", price=50)
            warbands.append(warband)
        self.warband, self.rival = warbands
        self.sword = Item.objects.create(name="Sword", type="Melee")
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=2, cost=10)
        self.trade = TradeRequest.objects.create(
            campaign=campaign,
            from_user=self.player,
            to_user=self.viewer,
            from_warband=self.warband,
            to_warband=self.rival,
            status=TradeRequest.STATUS_ACCEPTED,
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        self.base = f"/api/campaigns/{campaign.id}/trade-requests/{self.trade.id}/"

    def _post(self, user: Any, action: str, body: dict[str, Any] | None = None) -> Any:
        def call() -> tuple[int, Any]:
            client = APIClient()
            client.force_authenticate(user=user)
            response = client.post(f"{self.base}{action}/", body or {}, format="json")
            return response.status_code, response.json()

        return call

    @unittest.expectedFailure
    def test_two_locks_at_once_complete_the_trade(self):
        # ECON-TEST-06 (BUG-08): both read the request with neither side locked; each saves both flags, so
        # the second save erases the first lock and neither request sees both locks to complete the trade
        self.trade.from_offer = {"gold": 5, "items": [{"id": self.sword.id, "quantity": 1}]}
        self.trade.to_offer = {"gold": 3, "items": []}
        self.trade.save(update_fields=["from_offer", "to_offer"])
        rendezvous = Rendezvous()
        real = trade_views._consume_offer_trader

        with mock.patch.object(trade_views, "_consume_offer_trader", side_effect=rendezvous.before(real)):
            results = run_concurrently(self._post(self.player, "lock"), self._post(self.viewer, "lock"))

        self.assertEqual(sorted(status for status, _ in results), [200, 200])
        self.trade.refresh_from_db()
        self.assertEqual(
            (self.trade.status, self.trade.from_accepted, self.trade.to_accepted), ("completed", True, True)
        )
        self.assertEqual(WarbandItem.objects.get(warband=self.rival).quantity, 1)

    @unittest.expectedFailure
    def test_two_offers_at_once_keep_both_sides(self):
        # BUG-08: each offer saves both sides' offers, so the second save puts back the stale other side
        rendezvous = Rendezvous()
        real = trade_views._build_offer_payload

        with mock.patch.object(trade_views, "_build_offer_payload", side_effect=rendezvous.before(real)):
            results = run_concurrently(
                self._post(self.player, "offer", {"gold": 10}), self._post(self.viewer, "offer", {"gold": 7})
            )

        self.assertEqual([status for status, _ in results], [200, 200])
        self.trade.refresh_from_db()
        self.assertEqual((self.trade.from_offer.get("gold"), self.trade.to_offer.get("gold")), (10, 7))
