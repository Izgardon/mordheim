"""House-rule items: the clones half-price armour and improved shields make (BUG-51, BUG-52, PERF-44; CAMP-TEST-14
to -18).

A rule with an item effect clones the base armour (or shields) into the campaign and points every owned copy at the
clones; removing the rule points them back. The clones change only with their rule, the owned copies keep what was
paid for them, and a clone that goes stale hands its copies back to its source before it is deleted.
"""

from django.db import IntegrityError, connection, transaction
from django.test.utils import CaptureQueriesContext

from apps.campaigns.effects import EFFECT_KEYS
from apps.campaigns.services import house_rules
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
        return Item.objects.get(campaign=self.campaign, generated_effect_key=HALF, replaces=source)

    def owned(self, row: HeroItem) -> tuple[int, int | None]:
        row.refresh_from_db()
        return row.item_id, row.cost

    def test_editing_a_clone_detaches_it_and_deleting_or_reverting_it_is_refused(self):
        # CAMP-TEST-15 (was: an edit was refused too, 403; PR C's Calls: an edit detaches the clone from its rule, and
        # the rule leaves it alone from then on); a delete or a revert would fight the rule, so they stay refused
        armour = base_armour("Heavy Armour", 50)
        self.add_rule()
        clone = self.clone_of(armour)
        owned = HeroItem.objects.create(hero=self.hero, item=clone, cost=25)
        refusal = {
            "detail": "This item comes from a house rule and changes with it. Edit it (which detaches it from the rule),"
            " or change the house rule instead.",
            "code": "house_rule_item",
        }

        deleted = self.delete_as(self.owner, f"/api/items/{clone.id}/")
        reverted = self.post_as(self.owner, f"/api/items/{clone.id}/revert/")
        by_book_id = self.post_as(self.owner, f"/api/items/{armour.id}/revert/", {"campaign_id": self.campaign.id})
        edited = self.patch_as(self.owner, f"/api/items/{clone.id}/", {"name": "Cheap plate"})
        sync_half_price_armour_for_campaign(self.campaign.id)  # a reseed's resync

        self.assertEqual((deleted.status_code, deleted.data), (403, refusal))
        self.assertEqual((reverted.status_code, reverted.data), (403, refusal))
        self.assertEqual((by_book_id.status_code, by_book_id.data), (403, refusal))
        self.assertEqual((edited.status_code, edited.data["id"], edited.data["generated_effect_key"]), (200, clone.id, None))  # fmt: skip
        self.assertEqual(list(Item.objects.filter(replaces=armour).values_list("id", "name")), [(clone.id, "Cheap plate")])  # fmt: skip
        self.assertEqual(self.owned(owned), (clone.id, 25))
        self.assertIsNone(self.get_as(self.player, f"/api/items/{armour.id}/").data["generated_effect_key"])

    def test_enabling_a_rule_skips_a_book_item_the_campaign_has_its_own_version_of(self):
        # PR C's Calls: house_rule_skipped names the versions the rule left alone
        light, heavy = base_armour("Light Armour", 20), base_armour("Heavy Armour", 50)
        body = {"campaign_id": self.campaign.id, "availabilities": [{"cost": 40}]}
        version = self.patch_as(self.player, f"/api/items/{heavy.id}/", body).data["id"]

        rule = self.add_rule()

        self.assertEqual(rule.status_code, 201)
        [warning] = rule.data["warnings"]
        self.assertEqual((warning["code"], warning["items"]), ("house_rule_skipped", [{"id": version, "name": "Heavy Armour", "replaces": heavy.id}]))  # fmt: skip
        self.assertEqual(list(Item.objects.get(id=version).availabilities.values_list("cost", flat=True)), [40])
        self.assertEqual(list(self.clone_of(light).availabilities.values_list("cost", flat=True)), [10])
        self.assertFalse(Item.objects.filter(replaces=heavy, generated_effect_key=HALF).exists())

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
                replaces=armour,
                generated_effect_key=HALF,
            )


class HouseRuleEffectTests(CampaignTestCase):
    """One rule per effect (BUG-52, CAMP-TEST-18) and edits that leave the clones alone (PERF-44, CAMP-TEST-14)."""

    def setUp(self) -> None:
        super().setUp()
        self.armour = [base_armour("Light Armour", 20), base_armour("Heavy Armour", 50)]

    def add_rule(self, effect_key: str = HALF, title: str = "Half price armour"):
        return self.post_as(self.owner, self.url("rules/"), {"title": title, "effect_key": effect_key})

    def clone_rows(self) -> list[tuple[int, int]]:
        """(clone id, availability id) of every house-rule clone in the campaign."""
        availabilities = ItemAvailability.objects.filter(item__campaign=self.campaign, item__generated_effect_key=HALF)
        return sorted(availabilities.values_list("item_id", "id"))

    def test_creating_an_effect_again_answers_the_rule_that_exists(self):
        first = self.add_rule()
        again = self.add_rule(title="Half price armour, again")

        self.assertEqual((first.status_code, again.status_code), (201, 200))
        self.assertEqual((again.data["id"], again.data["title"]), (first.data["id"], "Half price armour"))
        self.assertEqual(self.get_as(self.player, self.url("rules/")).data[0]["id"], first.data["id"])
        self.assertEqual(len(self.clone_rows()), 2)
        plain = [self.post_as(self.owner, self.url("rules/"), {"title": f"No running {n}"}) for n in (1, 2)]
        self.assertEqual([response.status_code for response in plain], [201, 201])  # rules without an effect

    def test_a_title_edit_leaves_the_clones_alone(self):
        # PERF-44: every PATCH reverted and re-synced, about 70 queries, with new clone and availability ids
        rule = self.add_rule()
        before = self.clone_rows()
        self.client.force_authenticate(user=self.owner)

        with CaptureQueriesContext(connection) as captured:
            response = self.client.patch(self.url(f"rules/{rule.data['id']}/"), {"title": "Cheap plate"}, format="json")

        self.assertEqual((response.status_code, response.data["title"]), (200, "Cheap plate"))
        self.assertEqual(self.clone_rows(), before)
        self.assertEqual(len(captured), 3)  # membership, rule, UPDATE (target <= 4)

    def test_changing_the_effect_swaps_the_clones_and_a_taken_effect_is_refused(self):
        rule = self.add_rule()
        self.add_rule(effect_key="improved_shields", title="Shields")
        url = self.url(f"rules/{rule.data['id']}/")

        taken = self.patch_as(self.owner, url, {"effect_key": "improved_shields"})

        self.assertEqual(
            (taken.status_code, taken.data),
            (400, {"detail": "This campaign already has a house rule with that effect.", "code": "duplicate_effect"}),
        )
        self.assertEqual(len(self.clone_rows()), 2)

        cleared = self.patch_as(self.owner, url, {"effect_key": ""})

        self.assertEqual(cleared.status_code, 200)
        self.assertEqual(self.clone_rows(), [])


class EffectRegistryTests(CampaignTestCase):
    """IMP-69: effect keys come from one registry, which also serves the common rules."""

    def test_every_effect_has_a_sync_and_a_revert(self):
        self.assertEqual(set(house_rules.SYNCS), EFFECT_KEYS)
        self.assertEqual(set(house_rules.REVERTS), EFFECT_KEYS)

    def test_an_unknown_effect_is_refused_and_a_text_rule_needs_none(self):
        refused = self.post_as(self.owner, self.url("rules/"), {"title": "50% Ranged", "effect_key": "ranged_limit"})
        self.assertEqual(
            (refused.status_code, refused.json()), (400, {"effect_key": ["Unknown effect: ranged_limit."]})
        )
        for effect_key in ("", None):
            with self.subTest(effect_key=effect_key):
                body = {"title": f"Text {effect_key!r}", "effect_key": effect_key}
                self.assertEqual(self.post_as(self.owner, self.url("rules/"), body).status_code, 201)

    def test_members_read_the_common_rules(self):
        response = self.get_as(self.player, self.url("rules/common/"))

        self.assertEqual(response.status_code, 200)
        rules = response.json()
        self.assertEqual(len(rules), 8)
        self.assertEqual(set(rules[0]), {"id", "title", "description", "effect_key"})
        self.assertEqual({rule["effect_key"] for rule in rules if rule["effect_key"]}, EFFECT_KEYS)
        self.assertEqual(rules[0]["title"], "Half Price Armour")
