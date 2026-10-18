"""Concurrency: two trade writes at once (pass 2; ECON-TEST-06, BUG-08).

Each test runs two real requests on two threads (two database connections) with a `Rendezvous` patched in
between a write's read of the trade request and its write. The views used to load the request unlocked and
save both sides' fields, so both read before either wrote and one write was lost. Now each write locks the
request first: the second request waits at the lock while the first holds the rendezvous, which gives up
after its timeout, and each write saves only its own side.
"""

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
from apps.trades.models import TradeRequest
from apps.trades.services import lifecycle, requests
from apps.warbands.models import Hero, LedgerAction, Warband, WarbandItem
from apps.warbands.services import ledger


@override_settings(RATE_LIMIT_ENABLED=False)
class TradeConcurrencyTests(TransactionTestCase):
    def setUp(self) -> None:
        self.role = role = CampaignRole.objects.get_or_create(slug="player", defaults={"name": "Player"})[0]
        self.campaign = campaign = Campaign.objects.create(name="Shards", join_code="RACE01")
        users = [
            get_user_model().objects.create_user(username=email, email=email, password=None)
            for email in ("player@example.com", "viewer@example.com")
        ]
        self.player, self.viewer = users
        warbands = []
        for user, name in zip(users, ("Monks", "Rats"), strict=True):
            CampaignMembership.objects.create(campaign=campaign, user=user, role=role)
            warband = Warband.objects.create(campaign=campaign, user=user, name=name, faction="Any")
            ledger.record(warband, LedgerAction.REWARD, 50, "Purse")
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

    def _post(self, user: Any, action: str, body: dict[str, Any] | None = None, base: str | None = None) -> Any:
        def call() -> tuple[int, Any]:
            client = APIClient()
            client.force_authenticate(user=user)
            response = client.post(f"{base or self.base}{action}/", body or {}, format="json")
            return response.status_code, response.json()

        return call

    def test_two_locks_at_once_complete_the_trade(self):
        # ECON-TEST-06 (BUG-08): unlocked, both read the request with neither side locked and the second save
        # erased the first lock; locked, the second sees the first lock and completes the trade
        self.trade.from_offer = {"gold": 5, "items": [{"id": self.sword.id, "quantity": 1}]}
        self.trade.to_offer = {"gold": 3, "items": []}
        self.trade.save(update_fields=["from_offer", "to_offer"])
        rendezvous = Rendezvous()
        real = lifecycle.spend_trader

        with mock.patch.object(lifecycle, "spend_trader", side_effect=rendezvous.before(real)):
            results = run_concurrently(self._post(self.player, "lock"), self._post(self.viewer, "lock"))

        self.assertEqual(sorted(status for status, _ in results), [200, 200])
        self.trade.refresh_from_db()
        self.assertEqual(
            (self.trade.status, self.trade.from_accepted, self.trade.to_accepted), ("completed", True, True)
        )
        self.assertEqual(WarbandItem.objects.get(warband=self.rival).quantity, 1)

    def test_two_offers_at_once_keep_both_sides(self):
        # BUG-08: each offer used to save both sides' offers, so the second save put back the stale other side
        rendezvous = Rendezvous()
        real = lifecycle.build_offer

        with mock.patch.object(lifecycle, "build_offer", side_effect=rendezvous.before(real)):
            results = run_concurrently(
                self._post(self.player, "offer", {"gold": 10}), self._post(self.viewer, "offer", {"gold": 7})
            )

        self.assertEqual([status for status, _ in results], [200, 200])
        self.trade.refresh_from_db()
        self.assertEqual((self.trade.from_offer.get("gold"), self.trade.to_offer.get("gold")), (10, 7))

    def test_two_trades_naming_one_trader_spend_him_once(self):
        # BUG-08: the spend was read-modify-write, so two trades naming the same hero could both spend him; it
        # is now one guarded UPDATE. The second lock goes ahead with a warning (decision 9) and records nothing,
        # so neither trade can give back an action the other spent
        hero = Hero.objects.create(warband=self.warband, name="Haggler", unit_type="Champion")
        third = get_user_model().objects.create_user(username="c@example.com", email="c@example.com", password=None)
        CampaignMembership.objects.create(campaign=self.campaign, user=third, role=self.role)
        crows = Warband.objects.create(campaign=self.campaign, user=third, name="Crows", faction="Any")
        other = TradeRequest.objects.create(
            campaign=self.campaign,
            from_user=self.player,
            to_user=third,
            from_warband=self.warband,
            to_warband=crows,
            status=TradeRequest.STATUS_ACCEPTED,
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        TradeRequest.objects.filter(id__in=[self.trade.id, other.id]).update(from_offer={"trader_id": hero.id})
        other_base = f"/api/campaigns/{self.campaign.id}/trade-requests/{other.id}/"
        rendezvous = Rendezvous()
        real = lifecycle.spend_trader

        with mock.patch.object(lifecycle, "spend_trader", side_effect=rendezvous.before(real)):
            results = run_concurrently(
                self._post(self.player, "lock"), self._post(self.player, "lock", base=other_base)
            )

        self.assertEqual([status for status, _ in results], [200, 200])
        self.assertEqual(sorted(len(body.get("warnings", [])) for _, body in results), [0, 1])
        spent = TradeRequest.objects.filter(from_trader_spent=hero).count()
        locked = TradeRequest.objects.filter(from_accepted=True).count()
        self.assertEqual((spent, locked), (1, 2))

    def test_two_requests_at_once_open_one_trade(self):
        # BUG-114: both warbands are locked before the check for an open trade, so the second request waits for
        # the first and then finds its trade
        TradeRequest.objects.filter(id=self.trade.id).update(status=TradeRequest.STATUS_COMPLETED)
        url = f"/api/campaigns/{self.campaign.id}/trade-requests/"

        def ask(user: Any, target: Any) -> Any:
            def call() -> int:
                client = APIClient()
                client.force_authenticate(user=user)
                return client.post(url, {"target_user_id": target.id}, format="json").status_code

            return call

        rendezvous = Rendezvous()
        real = requests.open_trade_between
        with mock.patch.object(requests, "open_trade_between", side_effect=rendezvous.before(real)):
            statuses = run_concurrently(ask(self.player, self.viewer), ask(self.viewer, self.player))

        self.assertEqual(sorted(statuses), [201, 409])
        self.assertEqual(TradeRequest.objects.filter(status=TradeRequest.STATUS_PENDING).count(), 1)
