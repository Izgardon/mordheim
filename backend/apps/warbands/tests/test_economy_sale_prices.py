"""Suggested sale prices (decision 3, ECON-TWEAK-02): half the item's current campaign price, rounded up.

The browser used to suggest half of what the warband paid. The current price is a house-rule entry's when the
campaign has one of the item's name; an item with no current price falls back to half the copy's stored cost,
and says so (`sale_price_basis`). A sale without a price is sold at the suggestion; a client price still wins.
"""

from typing import Any

from apps.items.models import Item, ItemAvailability
from apps.warbands.models import WarbandItem

from .roster_support import HERO, RosterTestCase, make_unit, trade_rows, unit_url


class SuggestedSalePriceTests(RosterTestCase):
    def _stash(self) -> dict[str, dict]:
        return {entry["name"]: entry for entry in self.client.get(f"/api/warbands/{self.warband.id}/items/").json()}

    def _sale(self, entry: dict) -> tuple[int | None, str | None]:
        return entry["suggested_sale_price"], entry["sale_price_basis"]

    def test_half_the_current_price_rounded_up_whatever_was_paid(self):
        club = Item.objects.create(name="Club", type="Melee")
        ItemAvailability.objects.create(item=club, cost=15, rarity=2)
        WarbandItem.objects.create(warband=self.warband, item=club, quantity=1, cost=3)  # bought cheap

        self.assertEqual(self._sale(self._stash()["Club"]), (8, "campaign_price"))

    def test_a_house_rule_entry_sets_the_price_of_the_global_item(self):
        house_axe = Item.objects.create(name="Axe", type="Melee", campaign=self.campaign)
        ItemAvailability.objects.create(item=house_axe, cost=25, rarity=2)
        WarbandItem.objects.create(warband=self.warband, item=self.axe, quantity=1, cost=5)  # the global Axe
        hero = make_unit(HERO, self.warband)
        hero.hero_items.create(item=self.axe, cost=5)

        self.assertEqual(self._sale(self._stash()["Axe"]), (13, "campaign_price"))
        sheet = self.client.get(f"/api/warbands/{self.warband.id}/sheet/").json()
        self.assertEqual(self._sale(sheet["heroes"][0]["items"][0]), (13, "campaign_price"))
        detail = self.client.get(unit_url(HERO, self.warband.id, hero.id)).json()
        self.assertEqual(self._sale(detail["items"][0]), (13, "campaign_price"))

    def test_without_a_current_price_half_the_stored_cost_and_it_says_so(self):
        relic = Item.objects.create(name="Relic", type="Misc")  # no availability: no current price
        WarbandItem.objects.create(warband=self.warband, item=relic, quantity=1, cost=9)
        unknown = Item.objects.create(name="Idol", type="Misc")
        WarbandItem.objects.create(warband=self.warband, item=unknown, quantity=1)

        stash = self._stash()

        self.assertEqual(self._sale(stash["Relic"]), (5, "stored_cost"))
        self.assertEqual(self._sale(stash["Idol"]), (None, None))


class CurrentPriceTests(RosterTestCase):
    """Each copy says what Buy again would charge for it (decision 11): the current campaign price, house rule
    included, which the dialog shows instead of the global item's own price."""

    def test_copies_carry_the_current_campaign_price(self):
        house_axe = Item.objects.create(name="Axe", type="Melee", campaign=self.campaign)
        ItemAvailability.objects.create(item=house_axe, cost=25, rarity=2)
        WarbandItem.objects.create(warband=self.warband, item=self.axe, quantity=1, cost=5)
        relic = Item.objects.create(name="Relic", type="Misc")
        WarbandItem.objects.create(warband=self.warband, item=relic, quantity=1, cost=9)
        hero = make_unit(HERO, self.warband)
        hero.hero_items.create(item=self.axe, cost=5)

        stash = {entry["name"]: entry for entry in self.client.get(f"/api/warbands/{self.warband.id}/items/").json()}
        sheet = self.client.get(f"/api/warbands/{self.warband.id}/sheet/").json()

        self.assertEqual((stash["Axe"]["current_price"], stash["Relic"]["current_price"]), (25, None))
        self.assertEqual(sheet["heroes"][0]["items"][0]["current_price"], 25)


class SaleDefaultPriceTests(RosterTestCase):
    def _sell(self, **body: Any) -> Any:
        return self.client.post(f"/api/warbands/{self.warband.id}/item-sales/", body, format="json")

    def test_a_sale_without_a_price_sells_at_the_suggestion(self):
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=3, cost=4)
        hero = make_unit(HERO, self.warband)
        hero.hero_items.create(item=self.axe, cost=15)

        stash = self._sell(source_type="stash", item_id=self.sword.id, quantity=2)
        unit = self._sell(source_type="hero", source_id=hero.id, item_id=self.axe.id, quantity=1)
        chosen = self._sell(source_type="stash", item_id=self.sword.id, quantity=1, price=1)

        self.assertEqual((stash.status_code, unit.status_code, chosen.status_code), (200, 200, 200))
        self.assertEqual(
            trade_rows(self.warband),
            [("Sell", "Sword x 2", 10, None), ("Sell", "Axe", 3, None), ("Sell", "Sword", 1, None)],
        )

    def test_an_item_with_no_known_price_needs_one(self):
        idol = Item.objects.create(name="Idol", type="Misc")
        WarbandItem.objects.create(warband=self.warband, item=idol, quantity=1)

        response = self._sell(source_type="stash", item_id=idol.id, quantity=1)

        self.assertEqual(
            (response.status_code, response.json()), (400, {"detail": "No price is known for this item; send one."})
        )
        self.assertEqual(trade_rows(self.warband), [])
