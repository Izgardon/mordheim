"""House-rule items: the clones half-price armour and improved shields make (BUG-51; CAMP-TEST-15 to -17).

A rule with an item effect clones the base armour (or shields) into the campaign and points every owned copy at the
clones; removing the rule points them back. The clones change only with their rule, the owned copies keep what was
paid for them, and a clone that goes stale hands its copies back to its source before it is deleted.
"""

from django.db import IntegrityError, transaction

from apps.items.models import Item, ItemAvailability
from apps.items.services import HALF_PRICE_ARMOUR_EFFECT_KEY, sync_half_price_armour_for_campaign
from apps.warbands.models import Hero, HeroItem

from .campaign_support import CampaignTestCase

HALF = HALF_PRICE_ARMOUR_EFFECT_KEY


def base_armour(name: str, *costs: int) -> Item:
    item = Item.objects.create(name=name, type="Armour", subtype="Armour", save_value="5+")
    for cost in costs:
        ItemAvailability.objects.create(item=item, cost=cost, rarity=8)
    return item


class HouseRuleItemTests(CampaignTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.hero = Hero.objects.create(warband=self.warband, name="Abbess", unit_type="Matriarch")

    def add_rule(self, effect_key: str = HALF, title: str = "Half price armour"):
        return self.post_as(self.owner, self.url("rules/"), {"title": title, "effect_key": effect_key})

    def clone_of(self, source: Item) -> Item:
        return Item.objects.get(campaign=self.campaign, generated_effect_key=HALF, source_item=source)

    def owned(self, row: HeroItem) -> tuple[int, int | None]:
        row.refresh_from_db()
        return row.item_id, row.cost

    def test_a_clone_cannot_be_edited_or_deleted_as_an_item(self):
        # CAMP-TEST-15: an edit was lost on the next sync, and a delete cascaded to every owned copy
        armour = base_armour("Heavy Armour", 50)
        self.add_rule()
        clone = self.clone_of(armour)
        owned = HeroItem.objects.create(hero=self.hero, item=clone, cost=25)
        refusal = {
            "detail": "This item comes from a house rule and changes with it. Edit or delete the house rule instead.",
            "code": "house_rule_item",
        }

        edited = self.patch_as(self.owner, f"/api/items/{clone.id}/", {"name": "Cheap plate"})
        deleted = self.delete_as(self.owner, f"/api/items/{clone.id}/")

        self.assertEqual((edited.status_code, edited.data), (403, refusal))
        self.assertEqual((deleted.status_code, deleted.data), (403, refusal))
        self.assertEqual(Item.objects.get(id=clone.id).name, "Heavy Armour")
        self.assertEqual(self.owned(owned), (clone.id, 25))
        self.assertEqual(self.get_as(self.player, f"/api/items/{clone.id}/").data["generated_effect_key"], HALF)
        self.assertIsNone(self.get_as(self.player, f"/api/items/{armour.id}/").data["generated_effect_key"])

    def test_toggling_half_price_armour_keeps_what_was_paid(self):
        # CAMP-TEST-16: the remap halved the stored cost, reset it on revert, and made it None for a source with
        # several availabilities
        light = base_armour("Light Armour", 20)
        gromril = base_armour("Gromril Armour", 150, 100)
        bought = HeroItem.objects.create(hero=self.hero, item=light, cost=20)
        found = HeroItem.objects.create(hero=self.hero, item=gromril, cost=0)

        rule = self.add_rule()

        self.assertEqual(self.owned(bought), (self.clone_of(light).id, 20))
        self.assertEqual(self.owned(found), (self.clone_of(gromril).id, 0))

        self.delete_as(self.owner, self.url(f"rules/{rule.data['id']}/"))

        self.assertEqual((self.owned(bought), self.owned(found)), ((light.id, 20), (gromril.id, 0)))

    def test_a_stale_clone_hands_its_copies_back_to_its_source_before_it_goes(self):
        # CAMP-TEST-17: a base armour re-subtyped made its clone stale, and deleting it cascaded to the owned copies
        scale = base_armour("Scale Armour", 40)
        self.add_rule()
        owned = HeroItem.objects.create(hero=self.hero, item=self.clone_of(scale), cost=20)
        Item.objects.filter(id=scale.id).update(subtype="Barding")

        sync_half_price_armour_for_campaign(self.campaign.id)

        self.assertFalse(Item.objects.filter(campaign=self.campaign, generated_effect_key=HALF).exists())
        self.assertEqual(self.owned(owned), (scale.id, 20))

    def test_one_clone_per_source_and_effect_in_a_campaign(self):
        armour = base_armour("Heavy Armour", 50)
        self.add_rule()

        with self.assertRaises(IntegrityError), transaction.atomic():
            Item.objects.create(
                campaign=self.campaign,
                name="Heavy Armour",
                type="Armour",
                source_item=armour,
                generated_effect_key=HALF,
            )
