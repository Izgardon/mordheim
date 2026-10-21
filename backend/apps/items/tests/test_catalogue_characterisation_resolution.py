"""Characterisation: how a campaign's own entries and house-rule clones stand in for book entries (pass 5).

Prices (pass 2's `warbands/services/prices.py`) find a campaign's replacement for a book item by name alone, whatever
its type (BUG-18): it sets the book item's current price (what Buy again charges), its suggested sale price and an
availability's price. Unit writes and purchases still accept the book id the list hides and store copies of the book
entry. Recruits are charged the copies' recorded costs. Trait specials are read by name from every campaign
(BUG-103). PR C resolves all of these through `replaces` instead (CAT-TEST-26).
"""

from typing import Any

from apps.campaigns.models import Campaign
from apps.items.models import Item, ItemAvailability
from apps.special.models import Special
from apps.warbands.models import Hero, WarbandItem
from apps.warbands.tests.roster_support import (
    HENCHMEN,
    HERO,
    KINDS,
    RosterTestCase,
    create_payload,
    make_unit,
    trade_rows,
    unit_url,
)


class ResolutionTestCase(RosterTestCase):
    def buy(self, **body: Any) -> Any:
        response = self.client.post(f"/api/warbands/{self.warband.id}/purchases/", body, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()

    def stash(self) -> list[dict[str, Any]]:
        return list(self.client.get(f"/api/warbands/{self.warband.id}/items/").json())

    def house_item(self, name: str, cost: int, item_type: str = "Melee", campaign: Campaign | None = None) -> Item:
        item = Item.objects.create(name=name, type=item_type, campaign=campaign or self.campaign)
        ItemAvailability.objects.create(item=item, cost=cost, rarity=2)
        return item


class SameNamePriceTests(ResolutionTestCase):
    def test_a_campaign_item_of_another_type_sets_the_book_items_price_and_sale_price(self):
        # Characterises current behaviour (BUG-18, pinned; flips in PR C: only a version replacing the Axe counts)
        self.house_item("Axe", 25, item_type="Miscellaneous")
        WarbandItem.objects.create(warband=self.warband, item=self.axe, quantity=1, cost=5)

        [axe] = self.stash()
        self.buy(item_id=self.axe.id, target_type="stash")  # Buy again, no price sent

        self.assertEqual((axe["current_price"], axe["suggested_sale_price"], axe["sale_price_basis"]), (25, 13, "campaign_price"))  # fmt: skip
        self.assertEqual(trade_rows(self.warband), [("Buy", "Axe", -25, None)])

    def test_a_book_item_is_bought_at_the_price_of_a_same_named_campaign_items_availability(self):
        # Characterises current behaviour (BUG-18, pinned; flips in PR C)
        house = self.house_item("Axe", 40, item_type="Miscellaneous")

        body = self.buy(item_id=self.axe.id, availability_id=house.availabilities.get().id, target_type="stash")

        self.assertEqual(trade_rows(self.warband), [("Buy", "Axe", -40, None)])
        self.assertEqual(body["stash_item"]["id"], self.axe.id)  # the copy is still of the book Axe

    def test_another_campaigns_item_changes_nothing(self):
        self.house_item("Axe", 99, campaign=Campaign.objects.get(name="Elsewhere"))

        self.buy(item_id=self.axe.id, target_type="stash")

        self.assertEqual(trade_rows(self.warband), [("Buy", "Axe", -5, None)])

    def test_the_hidden_book_item_and_the_campaign_item_are_two_stash_rows_of_one_name(self):
        # Characterises current behaviour (BUG-18, pinned; flips in PR C: one entry, so one row)
        house_sword = self.house_item("Sword", 30)

        self.buy(item_id=self.sword.id, target_type="stash")  # a book id from a stale list or Buy again
        self.buy(item_id=house_sword.id, target_type="stash")

        rows = [(row["name"], row["id"], row["current_price"]) for row in self.stash()]
        self.assertCountEqual(rows, [("Sword", self.sword.id, 30), ("Sword", house_sword.id, 30)])
        self.assertEqual(trade_rows(self.warband), [("Buy", "Sword", -30, None), ("Buy", "Sword", -30, None)])


class PickerResolutionTests(ResolutionTestCase):
    def test_a_unit_write_naming_the_hidden_book_entry_keeps_the_book_entry_at_its_own_price(self):
        # Characterises current behaviour (BUG-18, CAT-TEST-26 baseline, pinned; flips in PR C: the campaign's version)
        self.house_item("Sword", 30)
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                payload = create_payload(kind, items=[{"id": self.sword.id}])

                response = self.client.post(unit_url(kind, self.warband.id), payload, format="json")

                self.assertEqual(response.status_code, 201, response.data)
                unit = kind.model.objects.get(id=response.data["id"])
                self.assertEqual(list(getattr(unit, kind.items).values_list("item_id", "cost")), [(self.sword.id, 10)])

    def test_recruits_are_charged_the_recorded_costs_not_the_campaign_price(self):
        # Not a bug: a henchman's share of the group's items is what the group paid (pass 2, decision 7)
        self.house_item("Sword", 30)
        group = make_unit(HENCHMEN, self.warband, name="Zealots", price=20, members=("A",))
        group.henchmen_group_items.create(item=self.sword, cost=10)

        detail = self.client.get(unit_url(HENCHMEN, self.warband.id, group.id)).json()

        self.assertEqual(detail["hire_cost"], 20 + 10)
        self.assertEqual(detail["items"][0]["current_price"], 30)  # Buy again would charge the campaign's 30


class HouseRuleCloneResolutionTests(ResolutionTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.armour = Item.objects.create(name="Heavy Armour", type="Armour", subtype="Armour", save_value="5+")
        ItemAvailability.objects.create(item=self.armour, cost=50, rarity=2)
        self.client.force_authenticate(user=self.campaign_owner)
        rule = {"title": "Half price armour", "effect_key": "half_price_armour"}
        self.assertEqual(self.client.post(f"/api/campaigns/{self.campaign.id}/rules/", rule, format="json").status_code, 201)  # fmt: skip
        self.client.force_authenticate(user=self.player)
        self.clone = Item.objects.get(campaign=self.campaign, replaces=self.armour)

    def test_the_clone_replaces_the_book_armour_in_the_shop_and_prices_its_book_id(self):
        listed = self.client.get(f"/api/items/?campaign_id={self.campaign.id}&type=armour").json()

        self.buy(item_id=self.armour.id, target_type="stash")  # the book id, from a list read before the rule

        self.assertEqual([(row["id"], row["availabilities"][0]["cost"]) for row in listed], [(self.clone.id, 25)])
        self.assertEqual(trade_rows(self.warband), [("Buy", "Heavy Armour", -25, None)])
        [row] = self.stash()
        # the copy stays on the book armour: the rule's remap ran before it was bought
        self.assertEqual((row["id"], row["current_price"]), (self.armour.id, 25))

    def test_a_copy_on_the_clone_reads_the_clones_price(self):
        hero = make_unit(HERO, self.warband)
        hero.hero_items.create(item=self.clone, cost=25)

        detail = self.client.get(unit_url(HERO, self.warband.id, hero.id)).json()

        self.assertEqual((detail["items"][0]["current_price"], detail["items"][0]["suggested_sale_price"]), (25, 13))


class TraitSpecialTests(ResolutionTestCase):
    def test_another_campaigns_large_special_is_the_one_a_large_unit_gets(self):
        # Characterises current behaviour (BUG-103, pinned; flips in PR C: the book Large, or this campaign's version).
        # Specials order by (type, name); the last "Large" read wins, here the other campaign's.
        theirs = Special.objects.create(name="Large", type="Zealot traits", campaign=Campaign.objects.get(name="Elsewhere"))  # fmt: skip

        created = self.client.post(unit_url(HERO, self.warband.id), create_payload(HERO, large=True), format="json")
        hero = make_unit(HERO, self.warband, name="Later")
        patched = self.client.patch(unit_url(HERO, self.warband.id, hero.id), {"large": True}, format="json")

        self.assertEqual((created.status_code, patched.status_code), (201, 200))
        for hero_id in (created.data["id"], hero.id):
            with self.subTest(hero=hero_id):
                specials = list(Hero.objects.get(id=hero_id).hero_specials.values_list("special_id", flat=True))
                self.assertEqual(specials, [theirs.id])
        self.assertNotIn(self.large.id, specials)

    def test_without_another_large_the_book_special_is_used(self):
        created = self.client.post(unit_url(HERO, self.warband.id), create_payload(HERO, large=True), format="json")

        self.assertEqual(list(Hero.objects.get(id=created.data["id"]).hero_specials.values_list("special_id", flat=True)), [self.large.id])  # fmt: skip
