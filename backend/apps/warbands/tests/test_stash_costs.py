"""The stash keeps each copy's cost (BUG-117): copies moved into it beside the ones held, and moved or sold
by cost. The stash used to keep one cost per item and re-price every copy to the last one known."""

from apps.warbands.models import WarbandItem

from .roster_support import HERO, ItemMoveHelpers, RosterTestCase, make_unit
from .test_roster_characterisation_items import SWORD_SALE


class StashCostTests(ItemMoveHelpers, RosterTestCase):
    def test_moving_into_the_stash_keeps_each_copys_cost_beside_the_copies_held(self):
        # BUG-117: the four copies used to become four at 10 (the last known cost)
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=2, cost=5)
        hero = self._armed(HERO)

        body = self._transfer(
            source_type="hero", source_id=hero.id, target_type="stash", item_id=self.sword.id, quantity=2
        ).json()

        # the row created last first: its copies leave first
        costs = [{"cost": 10, "quantity": 1}, {"cost": 12, "quantity": 1}, {"cost": 5, "quantity": 2}]
        stash_item = {"id": self.sword.id, "name": "Sword", "cost": 10, "quantity": 4, "costs": costs, **SWORD_SALE}
        self.assertEqual(body["stash_item"], stash_item)
        self.assertEqual(self._carried(HERO, hero), [(self.axe.id, 7)])

    def test_copies_moved_into_the_stash_keep_their_costs(self):
        # BUG-117: two copies at 12 and 10 used to become two at 10, and a copy of unknown cost took the row's
        hero = self._armed(HERO)

        body = self._transfer(
            source_type="hero", source_id=hero.id, target_type="stash", item_id=self.sword.id, quantity=2
        ).json()
        self.assertEqual(body["stash_item"]["costs"], [{"cost": 10, "quantity": 1}, {"cost": 12, "quantity": 1}])

        hero.hero_items.create(item=self.sword, cost=None)
        body = self._transfer(
            source_type="hero", source_id=hero.id, target_type="stash", item_id=self.sword.id, quantity=1
        ).json()
        costs = [{"cost": None, "quantity": 1}, {"cost": 10, "quantity": 1}, {"cost": 12, "quantity": 1}]
        self.assertEqual((body["stash_item"]["quantity"], body["stash_item"]["costs"]), (3, costs))

    def test_the_copies_of_one_cost_can_be_moved_or_sold_from_the_stash(self):
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=3, cost=5)
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=1, cost=12)
        hero = make_unit(HERO, self.warband)

        moved = self._transfer(
            source_type="stash", target_type="hero", target_id=hero.id, item_id=self.sword.id, quantity=2, cost=5
        )
        sale = {"source_type": "stash", "item_id": self.sword.id, "quantity": 1, "price": 6, "cost": 5}
        sold = self.client.post(f"/api/warbands/{self.warband.id}/item-sales/", sale, format="json")
        too_many = self.client.post(f"/api/warbands/{self.warband.id}/item-sales/", sale, format="json")

        self.assertEqual((moved.status_code, sold.status_code, too_many.status_code), (200, 200, 400))
        self.assertEqual(self._carried(HERO, hero), [(self.sword.id, 5), (self.sword.id, 5)])
        self.assertEqual(moved.json()["stash_item"]["costs"], [{"cost": 12, "quantity": 1}, {"cost": 5, "quantity": 1}])
        self.assertEqual(sold.json()["stash_item"]["costs"], [{"cost": 12, "quantity": 1}])
