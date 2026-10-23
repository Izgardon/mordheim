"""An item edited or reverted in the campaign while a trade is open (pass 5 PR C; CAT-TWEAK-03).

A trade's offers store stash item ids until both sides lock. An edit of a book item moves the stash's copies onto
the campaign's version, and a Revert moves them back, so completion maps each offered id through the campaign's
current version (a version reverted since included) instead of failing with "not in the warchest".
"""

from apps.items.models import Item, ItemAvailability

from .trade_support import TradeTestCase


class OpenTradeVersionTests(TradeTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.trade = self.open_trade()
        self.stash(self.warband, self.sword, 2, cost=10)

    def complete(self) -> None:
        self.lock(self.player, self.trade)
        self.assertEqual(self.lock(self.viewer, self.trade).json()["status"], "completed")

    def test_an_edit_mid_trade_moves_the_versions_copies(self):
        self.offer(self.player, self.trade, items=[{"id": self.sword.id, "quantity": 1}])
        version = Item.objects.create(name="Sword", type=self.sword.type, campaign=self.campaign, replaces=self.sword)
        ItemAvailability.objects.create(item=version, cost=15, rarity=2)
        self.sword.warband_items.update(item=version)  # what the first edit's remap does

        self.complete()

        self.assertEqual(self.stash_rows(self.warband), [("Sword", 1, 10)])
        self.assertEqual(list(self.rival.warband_items.values_list("item_id", "quantity", "cost")), [(version.id, 1, 10)])  # fmt: skip

    def test_a_revert_mid_trade_moves_the_book_items_copies(self):
        version = Item.objects.create(name="Sword", type=self.sword.type, campaign=self.campaign, replaces=self.sword)
        self.sword.warband_items.update(item=version)
        self.offer(self.player, self.trade, items=[{"id": version.id, "quantity": 2}])
        self.client.force_authenticate(user=self.campaign_owner)
        self.assertEqual(self.client.post(f"/api/items/{version.id}/revert/").status_code, 200)

        self.complete()

        self.assertEqual(list(self.rival.warband_items.values_list("item_id", "quantity")), [(self.sword.id, 2)])
