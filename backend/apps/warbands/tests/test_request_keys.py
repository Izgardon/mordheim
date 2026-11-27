"""Request keys (the offline plan's double buy): a gold-moving write sent again with its key is answered again.

On weak signal a Buy can go through on the server while its answer never arrives; tapping Buy again used to buy and
charge twice. Purchases, hires and the roster Save take an `Idempotency-Key` header: the first request with a key
writes it beside its answer in the write's transaction, and a repeat gets that answer back with nothing written.
"""

from datetime import timedelta
from typing import Any
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.campaigns.models import Campaign, CampaignMembership, CampaignRole
from apps.core.testing import Rendezvous, run_concurrently
from apps.hirelings.fees import make_fee
from apps.hirelings.models import HiredSword
from apps.items.models import Item
from apps.warbands.models import Hero, Hireling, LedgerAction, Warband, WarbandItem, WarbandRequestKey, WarbandTrade
from apps.warbands.services import ledger

from .roster_support import HERO, HIRELING, RosterTestCase, unit_url

KEY = "b6c1d0e2-4f7a-4a51-9d3c-2f1e8a7b6c5d"
OTHER_KEY = "0f9e8d7c-6b5a-4c3d-8e2f-1a0b9c8d7e6f"


class RequestKeyTestCase(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        ledger.record(self.warband, LedgerAction.REWARD, 100, "Purse")

    def buy(self, key: str | None = KEY, **body: Any) -> Any:
        line = {"item_id": self.sword.id, "price": 12, "target_type": "stash", **body}
        headers = {"Idempotency-Key": key} if key is not None else {}
        return self.client.post(f"/api/warbands/{self.warband.id}/purchases/", line, format="json", headers=headers)

    def buy_rows(self) -> int:
        return WarbandTrade.objects.filter(warband=self.warband, action=LedgerAction.BUY).count()

    def gold(self) -> int:
        return Warband.objects.get(id=self.warband.id).gold


class PurchaseKeyTests(RequestKeyTestCase):
    def test_a_purchase_sent_again_with_its_key_is_answered_again_and_charged_once(self):
        first = self.buy()
        again = self.buy()

        self.assertEqual((first.status_code, again.status_code), (201, 201), again.content)
        self.assertEqual(again.json(), first.json())
        self.assertEqual((self.buy_rows(), self.gold()), (1, 88))

    def test_another_key_or_none_is_another_purchase(self):
        self.buy()
        self.buy(key=OTHER_KEY)
        self.buy(key=None)
        self.buy(key=None)

        self.assertEqual((self.buy_rows(), self.gold()), (4, 52))

    def test_a_refusal_is_not_kept_so_the_same_key_is_checked_afresh(self):
        refused = self.buy(price=None, availability_id=999999)
        bought = self.buy()

        self.assertEqual((refused.status_code, bought.status_code), (400, 201))
        self.assertEqual(self.buy_rows(), 1)

    def test_a_badly_shaped_key_is_refused(self):
        response = self.buy(key="short")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "invalid_request_key")
        self.assertEqual(self.buy_rows(), 0)

    def test_a_key_sent_with_another_kind_of_write_is_refused(self):
        self.buy()
        url = unit_url(HERO, self.warband.id, suffix="batch/")
        body = {"create": [{"name": "Ana", "unit_type": "Champion", "price": 5}]}
        response = self.client.post(url, body, format="json", headers={"Idempotency-Key": KEY})

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["code"], "request_key_reused")
        self.assertFalse(Hero.objects.filter(warband=self.warband, name="Ana").exists())

    def test_a_repeat_tells_nobody_again(self):
        with mock.patch("apps.warbands.views.base.send_warband_changed") as announce:
            self.buy()
            self.buy()

        self.assertEqual(announce.call_count, 1)

    def test_keys_older_than_a_day_are_cleared_by_the_next_keyed_write(self):
        self.buy(key=OTHER_KEY)
        WarbandRequestKey.objects.filter(key=OTHER_KEY).update(created_at=timezone.now() - timedelta(days=2))

        self.buy()

        self.assertEqual(list(WarbandRequestKey.objects.values_list("key", flat=True)), [KEY])

    def test_a_repeat_runs_only_the_access_checks_and_its_lookup(self):
        self.buy()

        with self.assertNumQueries(3):  # the warband, the membership with its rights, the stored answer
            again = self.buy()
        self.assertEqual(again.status_code, 201)


class HireAndBatchKeyTests(RequestKeyTestCase):
    maxDiff = None

    def test_a_hire_sent_again_with_its_key_hires_once(self):
        ogre = HiredSword.objects.create(
            name="Ogre Bodyguard", hire_fee=make_fee(gold=80), upkeep_fee=make_fee(gold=30)
        )
        url = unit_url(HIRELING, self.warband.id, suffix="hire/")
        body = {"source": "hired_sword", "id": ogre.id}

        first = self.client.post(url, body, format="json", headers={"Idempotency-Key": KEY})
        again = self.client.post(url, body, format="json", headers={"Idempotency-Key": KEY})

        self.assertEqual((first.status_code, again.status_code), (201, 201), again.content)
        self.assertEqual(again.json()["id"], first.json()["id"])
        self.assertEqual(Hireling.objects.filter(warband=self.warband).count(), 1)
        self.assertEqual(self.gold(), 20)

    def test_a_roster_save_sent_again_with_its_key_recruits_once(self):
        url = unit_url(HERO, self.warband.id, suffix="batch/")
        body = {"create": [{"name": "Ana", "unit_type": "Champion", "price": 35}]}

        first = self.client.post(url, body, format="json", headers={"Idempotency-Key": KEY})
        again = self.client.post(url, body, format="json", headers={"Idempotency-Key": KEY})

        self.assertEqual((first.status_code, again.status_code), (200, 200), again.content)
        self.assertEqual(again.json(), first.json())
        self.assertEqual(Hero.objects.filter(warband=self.warband, name="Ana").count(), 1)
        self.assertEqual(self.gold(), 65)


class ConcurrentRepeatTests(TransactionTestCase):
    """Two repeats at once: both pass the lookup before either writes, and only one buys."""

    def setUp(self) -> None:
        role = CampaignRole.objects.get_or_create(slug="player", defaults={"name": "Player"})[0]
        campaign = Campaign.objects.create(name="Shards", join_code="RACE09")
        self.player = get_user_model().objects.create_user(username="p@example.com", email="p@example.com")
        CampaignMembership.objects.create(campaign=campaign, user=self.player, role=role)
        self.warband = Warband.objects.create(campaign=campaign, user=self.player, name="Monks")
        self.sword = Item.objects.create(name="Sword", type="Melee")

    def _post(self, body: dict[str, Any]) -> Any:
        def call() -> Any:
            client = APIClient(raise_request_exception=False)  # a crash answers 500 like production
            client.force_authenticate(user=self.player)
            url = f"/api/warbands/{self.warband.id}/purchases/"
            response = client.post(url, body, format="json", headers={"Idempotency-Key": KEY})
            return response.status_code, response.json()

        return call

    def _race(self, body: dict[str, Any]) -> list[Any]:
        from apps.warbands.views import purchases

        rendezvous = Rendezvous()
        with mock.patch.object(purchases, "purchase", side_effect=rendezvous.before(purchases.purchase)):
            return run_concurrently(self._post(body), self._post(body))

    def test_two_paid_repeats_at_once_charge_once(self):
        # the first locks the warband for its gold; the second waits, buys, then loses the key's insert and rolls back
        (first, first_body), (second, second_body) = self._race(
            {"item_id": self.sword.id, "price": 10, "target_type": "stash"}
        )

        self.assertEqual((first, second), (201, 201))
        self.assertEqual(first_body["trade"], second_body["trade"])
        self.assertEqual(WarbandTrade.objects.filter(warband=self.warband, action=LedgerAction.BUY).count(), 1)
        self.assertEqual(Warband.objects.get(id=self.warband.id).gold, -10)

    def test_two_gifts_at_once_add_once(self):
        # no gold, so no warband lock: the second waits at the key's unique insert instead
        (first, _), (second, _) = self._race(
            {"item_id": self.sword.id, "price": 10, "is_buying": False, "target_type": "stash"}
        )

        self.assertEqual((first, second), (201, 201))
        self.assertEqual(WarbandItem.objects.get(warband=self.warband).quantity, 1)
