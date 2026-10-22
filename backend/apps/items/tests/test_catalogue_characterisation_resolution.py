"""How a campaign's versions and house-rule clones stand in for book entries (pass 5; CAT-TWEAK-03, CAT-TEST-26).

Since PR C every "current version" lookup goes through `replaces`, never the name (BUG-18): prices (pass 2's
`warbands/services/prices.py`: Buy again, the suggested sale price, an availability's price), unit writes,
purchases and stash adds (a book id lands on the campaign's version) and trait specials (the book's, or this
campaign's version of one: BUG-103). A campaign entry that merely shares a book entry's name, of any type, changes
nothing. Recruits are charged the copies' recorded costs.
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
    def buy(self, status: int = 201, **body: Any) -> Any:
        response = self.client.post(f"/api/warbands/{self.warband.id}/purchases/", body, format="json")
        self.assertEqual(response.status_code, status, response.content)
        return response.json()

    def stash(self) -> list[dict[str, Any]]:
        return list(self.client.get(f"/api/warbands/{self.warband.id}/items/").json())

    def house_item(self, name: str, cost: int, item_type: str = "Melee", **fields: Any) -> Item:
        """A campaign item written directly (`replaces`: a version of that book item)."""
        item = Item.objects.create(name=name, type=item_type, campaign=fields.pop("campaign", self.campaign), **fields)
        ItemAvailability.objects.create(item=item, cost=cost, rarity=2)
        return item


class SameNamePriceTests(ResolutionTestCase):
    def test_a_campaign_item_of_another_type_changes_nothing_but_a_version_sets_the_price(self):
        # BUG-18 (was pinned: a same-named campaign item of any type set the book item's price and sale price;
        # flipped in PR C: only a version replacing the Axe counts)
        self.house_item("Axe", 25, item_type="Miscellaneous")
        WarbandItem.objects.create(warband=self.warband, item=self.axe, quantity=1, cost=5)

        [before] = self.stash()
        self.buy(item_id=self.axe.id, target_type="stash")  # Buy again, no price sent: the book Axe's 5
        version = self.house_item("Axe", 30, replaces=self.axe)
        after = next(row for row in self.stash() if row["id"] == self.axe.id)

        self.assertEqual((before["current_price"], before["suggested_sale_price"]), (5, 3))
        self.assertEqual((after["current_price"], after["suggested_sale_price"]), (30, 15))
        self.assertEqual(trade_rows(self.warband), [("Buy", "Axe", -5, None)])
        self.assertNotEqual(version.id, self.axe.id)

    def test_a_book_item_is_bought_at_its_versions_availability_and_not_a_same_named_items(self):
        # BUG-18 (was pinned: any same-named campaign item's availability priced the book item; flipped in PR C)
        house = self.house_item("Axe", 40, item_type="Miscellaneous")
        refused = self.buy(400, item_id=self.axe.id, availability_id=house.availabilities.get().id, target_type="stash")
        version = self.house_item("Axe", 35, replaces=self.axe)

        body = self.buy(item_id=self.axe.id, availability_id=version.availabilities.get().id, target_type="stash")

        self.assertEqual(refused["fields"], {"availability_id": ["Not one of this item's availabilities."]})
        self.assertEqual(trade_rows(self.warband), [("Buy", "Axe", -35, None)])
        self.assertEqual(body["stash_item"]["id"], version.id)  # the copy is of the version

    def test_another_campaigns_version_changes_nothing(self):
        self.house_item("Axe", 99, campaign=Campaign.objects.get(name="Elsewhere"), replaces=self.axe)

        self.buy(item_id=self.axe.id, target_type="stash")

        self.assertEqual(trade_rows(self.warband), [("Buy", "Axe", -5, None)])

    def test_the_book_id_and_the_version_id_buy_into_one_stash_row(self):
        # BUG-18 (was pinned: the hidden book item and the campaign item were two stash rows of one name; flipped in
        # PR C: a book id from a stale list or Buy again lands on the version)
        house_sword = self.house_item("Sword", 30, replaces=self.sword)

        self.buy(item_id=self.sword.id, target_type="stash")
        self.buy(item_id=house_sword.id, target_type="stash")

        rows = [(row["name"], row["id"], row["quantity"], row["current_price"]) for row in self.stash()]
        self.assertEqual(rows, [("Sword", house_sword.id, 2, 30)])
        self.assertEqual(trade_rows(self.warband), [("Buy", "Sword", -30, None), ("Buy", "Sword", -30, None)])


class PickerResolutionTests(ResolutionTestCase):
    def test_a_unit_write_naming_the_book_entry_stores_the_campaigns_version_at_its_price(self):
        # CAT-TEST-26 (was pinned: the book entry at its own price, BUG-18; flipped in PR C: the campaign's version)
        house_sword = self.house_item("Sword", 30, replaces=self.sword)
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                payload = create_payload(kind, items=[{"id": self.sword.id}])

                response = self.client.post(unit_url(kind, self.warband.id), payload, format="json")

                self.assertEqual(response.status_code, 201, response.data)
                unit = kind.model.objects.get(id=response.data["id"])
                self.assertEqual(list(getattr(unit, kind.items).values_list("item_id", "cost")), [(house_sword.id, 30)])

    def test_recruits_are_charged_the_recorded_costs_not_the_campaign_price(self):
        # Not a bug: a henchman's share of the group's items is what the group paid (pass 2, decision 7)
        self.house_item("Sword", 30, replaces=self.sword)
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

    def test_the_clone_replaces_the_book_armour_in_the_shop_and_takes_its_book_id(self):
        listed = self.client.get(f"/api/items/?campaign_id={self.campaign.id}&type=armour").json()

        self.buy(item_id=self.armour.id, target_type="stash")  # the book id, from a list read before the rule

        self.assertEqual([(row["id"], row["availabilities"][0]["cost"]) for row in listed], [(self.clone.id, 25)])
        self.assertEqual(trade_rows(self.warband), [("Buy", "Heavy Armour", -25, None)])
        [row] = self.stash()
        # CAT-TWEAK-03 (was: the copy stayed on the book armour; PR C): the copy is of the clone
        self.assertEqual((row["id"], row["current_price"]), (self.clone.id, 25))

    def test_a_copy_on_the_clone_reads_the_clones_price(self):
        hero = make_unit(HERO, self.warband)
        hero.hero_items.create(item=self.clone, cost=25)

        detail = self.client.get(unit_url(HERO, self.warband.id, hero.id)).json()

        self.assertEqual((detail["items"][0]["current_price"], detail["items"][0]["suggested_sale_price"]), (25, 13))


class TraitSpecialTests(ResolutionTestCase):
    def large_specials(self, hero_id: int) -> list[int]:
        return list(Hero.objects.get(id=hero_id).hero_specials.values_list("special_id", flat=True))

    def test_another_campaigns_large_special_is_never_the_one_a_large_unit_gets(self):
        # BUG-103 (was pinned: every campaign's "Large" was read and the last one won; flipped in PR C)
        Special.objects.create(name="Large", type="Zealot traits", campaign=Campaign.objects.get(name="Elsewhere"))
        Special.objects.create(name="Large", type="Zealot traits", campaign=self.campaign)  # not a version either

        created = self.client.post(unit_url(HERO, self.warband.id), create_payload(HERO, large=True), format="json")
        hero = make_unit(HERO, self.warband, name="Later")
        patched = self.client.patch(unit_url(HERO, self.warband.id, hero.id), {"large": True}, format="json")

        self.assertEqual((created.status_code, patched.status_code), (201, 200))
        for hero_id in (created.data["id"], hero.id):
            with self.subTest(hero=hero_id):
                self.assertEqual(self.large_specials(hero_id), [self.large.id])

    def test_the_campaigns_version_of_large_is_the_one_a_large_unit_gets(self):
        # BUG-103, CAT-TEST-26: the book's trait specials, then the campaign's versions of them
        version = Special.objects.create(name="Huge", type="Trait", campaign=self.campaign, replaces=self.large)
        created = self.client.post(unit_url(HERO, self.warband.id), create_payload(HERO, large=True), format="json")
        url = unit_url(HERO, self.warband.id, created.data["id"])

        large = self.large_specials(created.data["id"])
        self.client.patch(url, {"large": False}, format="json")
        unlarge = self.large_specials(created.data["id"])
        self.client.patch(url, {"large": True}, format="json")

        self.assertEqual((large, unlarge, self.large_specials(created.data["id"])), ([version.id], [], [version.id]))
