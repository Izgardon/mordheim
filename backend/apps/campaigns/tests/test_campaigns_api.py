from datetime import UTC, datetime

from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient, APITestCase

from apps.battles.models import Battle, BattleEvent, BattleKill, BattleParticipant
from apps.campaigns.models import (
    CampaignBulletinEntry,
    CampaignEncampment,
    CampaignLocation,
    CampaignMembership,
    CampaignMembershipPermission,
    CampaignPermission,
    CampaignRole,
    CampaignSettings,
)
from apps.core.testing import book_warband_type
from apps.items.models import (
    Item,
    ItemAvailability,
    ItemAvailabilityWarband,
    ItemRule,
    ItemRuleLink,
)
from apps.restrictions.models import Restriction
from apps.warbands.models import (
    Henchman,
    HenchmenGroup,
    HenchmenGroupItem,
    Hero,
    HeroItem,
    Hireling,
    HirelingItem,
    Warband,
    WarbandItem,
)


class CampaignApiTests(APITestCase):
    client: APIClient

    def setUp(self):
        self.client = APIClient()
        cache.clear()
        self.user_model = get_user_model()
        self.password = "testpass123"

    def _create_user(self, email, name=""):
        return self.user_model.objects.create_user(
            username=email,
            email=email,
            password=self.password,
            first_name=name,
        )

    def _create_campaign(self, user, name="Shards of the Comet", max_players=6, pages=False):
        self.client.force_authenticate(user=user)
        payload = {
            "name": name,
            "max_players": max_players,
        }
        if pages:  # the Encampment page and Locations switched on
            payload.update(enable_encampments=True, enable_locations=True)
        response = self.client.post(
            "/api/campaigns/",
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        return response.data

    def _grant_campaign_permission(self, campaign_id, user, permission_code):
        membership = CampaignMembership.objects.get(campaign_id=campaign_id, user=user)
        CampaignMembershipPermission.objects.get_or_create(
            membership=membership,
            permission=CampaignPermission.objects.get(code=permission_code),
        )

    def _create_setting(self, name="Cathay Setting"):
        return Restriction.objects.create(type="Setting", restriction=name)

    def _create_warband_restriction(self, name="Reiklanders"):
        return Restriction.objects.create(type="Warband", restriction=name)

    def _create_base_item(
        self,
        name,
        *,
        subtype="Armour",
        cost=50,
        rarity=8,
        flavour="",
        save_value="5+",
        note="",
        warband_types=None,
        rules=None,
    ):
        item = Item.objects.create(
            name=name,
            type="Armour",
            subtype=subtype,
            flavour=flavour,
            save_value=save_value,
        )
        availability = ItemAvailability.objects.create(
            item=item,
            cost=cost,
            rarity=rarity if rarity > 2 else None,
            note=note,
            for_everyone=not warband_types,
        )
        for warband_type in warband_types or []:
            ItemAvailabilityWarband.objects.create(availability=availability, warband_type=warband_type)
        for rule in rules or []:
            ItemRuleLink.objects.create(item=item, rule=rule)
        return item

    def _create_half_price_armour_rule(self, owner, campaign_id, title="Half Price Armour"):
        self.client.force_authenticate(user=owner)
        return self.client.post(
            f"/api/campaigns/{campaign_id}/rules/",
            {
                "title": title,
                "description": "All armour is half price.",
                "effect_key": "half_price_armour",
            },
            format="json",
        )

    def _create_improved_shields_rule(self, owner, campaign_id, title="Improved Shields"):
        self.client.force_authenticate(user=owner)
        return self.client.post(
            f"/api/campaigns/{campaign_id}/rules/",
            {
                "title": title,
                "description": "Shields are improved in close combat.",
                "effect_key": "improved_shields",
            },
            format="json",
        )

    def test_create_campaign_creates_owner_membership(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)

        membership = CampaignMembership.objects.get(campaign_id=campaign["id"], user=owner)
        self.assertEqual(membership.role.slug, "owner")
        self.assertEqual(len(campaign["join_code"]), 6)

    def test_create_campaign_defaults_encampments_and_locations_to_false(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)

        self.assertFalse(campaign["enable_encampments"])
        self.assertFalse(campaign["enable_locations"])

        settings = CampaignSettings.objects.get(campaign_id=campaign["id"])
        self.assertFalse(settings.enable_encampments)
        self.assertFalse(settings.enable_locations)

    def test_create_campaign_can_switch_on_encampments_and_locations(self):
        owner = self._create_user("owner@example.com", "Owner")

        self.client.force_authenticate(user=owner)
        response = self.client.post(
            "/api/campaigns/",
            {
                "name": "Marienburg on the March",
                "enable_encampments": True,
                "enable_locations": True,
                "max_players": 6,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["enable_encampments"])
        self.assertTrue(response.data["enable_locations"])

        settings = CampaignSettings.objects.get(campaign_id=response.data["id"])
        self.assertTrue(settings.enable_encampments)
        self.assertTrue(settings.enable_locations)

    def test_patch_campaign_updates_encampments_and_locations(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)

        self.client.force_authenticate(user=owner)
        response = self.client.patch(
            f"/api/campaigns/{campaign['id']}/",
            {"enable_encampments": True, "enable_locations": True},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["enable_encampments"])
        self.assertTrue(response.data["enable_locations"])

        settings = CampaignSettings.objects.get(campaign_id=campaign["id"])
        self.assertTrue(settings.enable_encampments)
        self.assertTrue(settings.enable_locations)

    def test_create_half_price_armour_rule_creates_discounted_campaign_clones(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)
        nobles = book_warband_type("Nobles")
        bulky = ItemRule.objects.create(name="Bulky", text="Very heavy.")
        heavy_armour = self._create_base_item(
            "Heavy Armour",
            cost=51,
            rarity=9,
            flavour="Heavy suit",
            save_value="5+",
            note="Only nobles",
            warband_types=[nobles],
            rules=[bulky],
        )
        chaos_armour = self._create_base_item(
            "Chaos Armour",
            cost=185,
            rarity=11,
            flavour="Warp-forged plate",
            save_value="4+",
        )
        self._create_base_item("Shield", subtype="Shield", cost=5, rarity=2, save_value="")

        response = self._create_half_price_armour_rule(owner, campaign["id"])

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["effect_key"], "half_price_armour")

        clones = Item.objects.filter(
            campaign_id=campaign["id"],
            generated_effect_key="half_price_armour",
        ).select_related("replaces")
        self.assertEqual(clones.count(), 2)
        self.assertFalse(clones.filter(replaces__subtype="Shield").exists())

        heavy_clone = clones.get(replaces=heavy_armour)
        self.assertEqual(heavy_clone.name, heavy_armour.name)
        self.assertEqual(heavy_clone.type, heavy_armour.type)
        self.assertEqual(heavy_clone.subtype, heavy_armour.subtype)
        self.assertEqual(heavy_clone.flavour, heavy_armour.flavour)
        self.assertEqual(heavy_clone.save_value, heavy_armour.save_value)
        self.assertEqual(heavy_clone.replaces_id, heavy_armour.id)

        heavy_clone_availability = heavy_clone.availabilities.get()
        self.assertEqual(heavy_clone_availability.cost, 26)
        self.assertEqual(heavy_clone_availability.rarity, 9)
        self.assertEqual(
            (heavy_clone_availability.note, heavy_clone_availability.for_everyone),
            ("Only nobles", False),
        )
        self.assertEqual(
            list(heavy_clone_availability.warband_links.values_list("warband_type__name", flat=True)),
            ["Nobles"],
        )
        self.assertEqual(
            list(heavy_clone.rule_links.values_list("rule__name", flat=True)),
            ["Bulky"],
        )

        chaos_clone = clones.get(replaces=chaos_armour)
        self.assertEqual(chaos_clone.availabilities.get().cost, 93)

    def test_creating_half_price_armour_rule_twice_is_idempotent_for_generated_items(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)
        replaces = self._create_base_item("Light Armour", cost=20, rarity=8)

        first_response = self._create_half_price_armour_rule(owner, campaign["id"])
        second_response = self._create_half_price_armour_rule(owner, campaign["id"], title="Half Price Armour Copy")

        self.assertEqual(first_response.status_code, 201)
        self.assertEqual(second_response.status_code, 200)  # the rule that exists (BUG-52)
        self.assertEqual(second_response.data["id"], first_response.data["id"])
        clones = Item.objects.filter(
            campaign_id=campaign["id"],
            generated_effect_key="half_price_armour",
            replaces=replaces,
        )
        self.assertEqual(clones.count(), 1)
        self.assertEqual(clones.get().availabilities.get().cost, 10)

    def test_create_half_price_armour_rule_remaps_owned_items_to_discounted_clones(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)
        armour = self._create_base_item("Ithilmar Armour", cost=91, rarity=11)
        warband = Warband.objects.create(
            campaign_id=campaign["id"],
            user=owner,
            name="Iron Vultures",
        )
        hero = Hero.objects.create(warband=warband, name="Captain", unit_type="Leader")
        hireling = Hireling.objects.create(warband=warband, name="Scout", unit_type="Ranger")
        group = HenchmenGroup.objects.create(warband=warband, name="Youngbloods", unit_type="Mercenary")
        WarbandItem.objects.create(warband=warband, item=armour, quantity=2, cost=91)
        HeroItem.objects.create(hero=hero, item=armour, cost=91)
        HirelingItem.objects.create(hireling=hireling, item=armour, cost=91)
        HenchmenGroupItem.objects.create(henchmen_group=group, item=armour, cost=91)

        response = self._create_half_price_armour_rule(owner, campaign["id"])

        self.assertEqual(response.status_code, 201)
        clone = Item.objects.get(
            campaign_id=campaign["id"],
            generated_effect_key="half_price_armour",
            replaces=armour,
        )
        self.assertEqual(WarbandItem.objects.get(warband=warband).item_id, clone.id)
        self.assertEqual(WarbandItem.objects.get(warband=warband).cost, 91)  # what was paid (BUG-51)
        self.assertEqual(HeroItem.objects.get(hero=hero).item_id, clone.id)
        self.assertEqual(HeroItem.objects.get(hero=hero).cost, 91)
        self.assertEqual(HirelingItem.objects.get(hireling=hireling).item_id, clone.id)
        self.assertEqual(HirelingItem.objects.get(hireling=hireling).cost, 91)
        self.assertEqual(HenchmenGroupItem.objects.get(henchmen_group=group).item_id, clone.id)
        self.assertEqual(HenchmenGroupItem.objects.get(henchmen_group=group).cost, 91)

    def test_delete_half_price_armour_rule_restores_owned_items_and_removes_clones(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)
        armour = self._create_base_item("Gromril Armour", cost=150, rarity=11)
        warband = Warband.objects.create(
            campaign_id=campaign["id"],
            user=owner,
            name="Steel Faith",
        )
        hero = Hero.objects.create(warband=warband, name="Noble", unit_type="Hero")
        WarbandItem.objects.create(warband=warband, item=armour, quantity=1, cost=150)
        HeroItem.objects.create(hero=hero, item=armour, cost=150)

        create_response = self._create_half_price_armour_rule(owner, campaign["id"])
        rule_id = create_response.data["id"]
        clone = Item.objects.get(
            campaign_id=campaign["id"],
            generated_effect_key="half_price_armour",
            replaces=armour,
        )
        self.assertEqual(WarbandItem.objects.get(warband=warband).item_id, clone.id)

        self.client.force_authenticate(user=owner)
        delete_response = self.client.delete(f"/api/campaigns/{campaign['id']}/rules/{rule_id}/")

        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(
            Item.objects.filter(
                campaign_id=campaign["id"],
                generated_effect_key="half_price_armour",
            ).exists()
        )
        self.assertEqual(WarbandItem.objects.get(warband=warband).item_id, armour.id)
        self.assertEqual(WarbandItem.objects.get(warband=warband).cost, 150)
        self.assertEqual(HeroItem.objects.get(hero=hero).item_id, armour.id)
        self.assertEqual(HeroItem.objects.get(hero=hero).cost, 150)

    def test_delete_half_price_armour_rule_merges_stash_rows_on_revert_collision(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)
        armour = self._create_base_item("Lamellar Armour", cost=120, rarity=10)
        warband = Warband.objects.create(
            campaign_id=campaign["id"],
            user=owner,
            name="Golden Blades",
        )
        WarbandItem.objects.create(warband=warband, item=armour, quantity=1, cost=120)

        create_response = self._create_half_price_armour_rule(owner, campaign["id"])
        rule_id = create_response.data["id"]
        clone = Item.objects.get(
            campaign_id=campaign["id"],
            generated_effect_key="half_price_armour",
            replaces=armour,
        )
        self.assertEqual(WarbandItem.objects.get(warband=warband).item_id, clone.id)

        WarbandItem.objects.create(warband=warband, item=armour, quantity=3, cost=120)

        self.client.force_authenticate(user=owner)
        delete_response = self.client.delete(f"/api/campaigns/{campaign['id']}/rules/{rule_id}/")

        self.assertEqual(delete_response.status_code, 204)
        stash_rows = WarbandItem.objects.filter(warband=warband, item=armour)
        self.assertEqual(stash_rows.count(), 1)
        self.assertEqual(stash_rows.get().quantity, 4)
        self.assertEqual(stash_rows.get().cost, 120)

    def test_create_improved_shields_rule_creates_campaign_shield_clones_with_cc_save_text(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)
        shield = self._create_base_item("Shield", subtype="Shield", cost=5, rarity=2, save_value="6+")
        pavise = self._create_base_item("Pavise", subtype="Shield", cost=25, rarity=8, save_value="6+")
        buckler = self._create_base_item("Buckler", subtype="Shield", cost=5, rarity=2, save_value="")
        self._create_base_item("Heavy Armour", subtype="Armour", cost=50, rarity=8, save_value="5+")

        response = self._create_improved_shields_rule(owner, campaign["id"])

        self.assertEqual(response.status_code, 201)
        clones = Item.objects.filter(
            campaign_id=campaign["id"],
            generated_effect_key="improved_shields",
        ).select_related("replaces")
        self.assertEqual(clones.count(), 3)

        shield_clone = clones.get(replaces=shield)
        self.assertEqual(shield_clone.save_value, "6+ (5+ CC)")
        self.assertEqual(shield_clone.availabilities.get().cost, 5)

        pavise_clone = clones.get(replaces=pavise)
        self.assertEqual(pavise_clone.save_value, "6+ (5+ CC)")
        self.assertEqual(pavise_clone.availabilities.get().cost, 25)

        buckler_clone = clones.get(replaces=buckler)
        self.assertEqual(buckler_clone.save_value, "")

    def test_create_improved_shields_rule_remaps_owned_items_to_shield_clones(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)
        shield = self._create_base_item("Shield", subtype="Shield", cost=5, rarity=2, save_value="6+")
        warband = Warband.objects.create(
            campaign_id=campaign["id"],
            user=owner,
            name="Wardens",
        )
        hero = Hero.objects.create(warband=warband, name="Captain", unit_type="Leader")
        WarbandItem.objects.create(warband=warband, item=shield, quantity=2, cost=5)
        HeroItem.objects.create(hero=hero, item=shield, cost=5)

        response = self._create_improved_shields_rule(owner, campaign["id"])

        self.assertEqual(response.status_code, 201)
        clone = Item.objects.get(
            campaign_id=campaign["id"],
            generated_effect_key="improved_shields",
            replaces=shield,
        )
        self.assertEqual(clone.save_value, "6+ (5+ CC)")
        self.assertEqual(WarbandItem.objects.get(warband=warband).item_id, clone.id)
        self.assertEqual(WarbandItem.objects.get(warband=warband).cost, 5)
        self.assertEqual(HeroItem.objects.get(hero=hero).item_id, clone.id)
        self.assertEqual(HeroItem.objects.get(hero=hero).cost, 5)

    def test_delete_improved_shields_rule_restores_owned_items_and_removes_shield_clones(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)
        shield = self._create_base_item("Kite Shield", subtype="Shield", cost=10, rarity=2, save_value="5+")
        warband = Warband.objects.create(
            campaign_id=campaign["id"],
            user=owner,
            name="Lances",
        )
        WarbandItem.objects.create(warband=warband, item=shield, quantity=1, cost=10)

        create_response = self._create_improved_shields_rule(owner, campaign["id"])
        rule_id = create_response.data["id"]
        clone = Item.objects.get(
            campaign_id=campaign["id"],
            generated_effect_key="improved_shields",
            replaces=shield,
        )
        self.assertEqual(WarbandItem.objects.get(warband=warband).item_id, clone.id)

        self.client.force_authenticate(user=owner)
        delete_response = self.client.delete(f"/api/campaigns/{campaign['id']}/rules/{rule_id}/")

        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(
            Item.objects.filter(
                campaign_id=campaign["id"],
                generated_effect_key="improved_shields",
            ).exists()
        )
        self.assertEqual(WarbandItem.objects.get(warband=warband).item_id, shield.id)
        self.assertEqual(WarbandItem.objects.get(warband=warband).cost, 10)

    def test_list_campaigns_returns_only_user_campaigns(self):
        owner = self._create_user("owner@example.com", "Owner")
        second_owner = self._create_user("second@example.com", "Second")
        campaign = self._create_campaign(owner, name="Ashes")
        self._create_campaign(second_owner, name="Ruins")

        self.client.force_authenticate(user=owner)
        response = self.client.get("/api/campaigns/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], campaign["id"])

    def test_list_campaigns_shows_your_own_warband_in_each(self):
        owner = self._create_user("owner@example.com", "Owner")
        player = self._create_user("player@example.com", "Player")
        ashes = self._create_campaign(owner, name="Ashes")
        ruins = self._create_campaign(owner, name="Ruins")
        self.client.force_authenticate(user=player)
        self.client.post("/api/campaigns/join/", {"join_code": ashes["join_code"]}, format="json")
        middenheimers = book_warband_type("Middenheimers")
        mine = Warband.objects.create(
            campaign_id=ashes["id"], user=owner, name="Iron Vultures", warband_type=middenheimers
        )
        Warband.objects.create(campaign_id=ashes["id"], user=player, name="Gutter Rats")

        self.client.force_authenticate(user=owner)
        listed = {row["name"]: row["my_warband"] for row in self.client.get("/api/campaigns/").data}

        self.assertEqual(listed["Ashes"], {"id": mine.id, "name": "Iron Vultures", "type_name": "Middenheimers"})
        self.assertIsNone(listed["Ruins"])
        self.assertNotIn("my_warband", self.client.get(f"/api/campaigns/{ruins['id']}/").data)

    def test_join_campaign_respects_max_players(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner, max_players=2)
        join_code = campaign["join_code"]

        player = self._create_user("player@example.com", "Player")
        self.client.force_authenticate(user=player)
        response = self.client.post(
            "/api/campaigns/join/",
            {"join_code": join_code},
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        latecomer = self._create_user("late@example.com", "Late")
        self.client.force_authenticate(user=latecomer)
        response = self.client.post(
            "/api/campaigns/join/",
            {"join_code": join_code},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data.get("detail"), "Campaign is full")

    def test_players_requires_membership(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)

        outsider = self._create_user("outsider@example.com", "Outsider")
        self.client.force_authenticate(user=outsider)
        response = self.client.get(f"/api/campaigns/{campaign['id']}/players/")
        self.assertEqual(response.status_code, 404)

    def test_posting_a_restriction_is_not_allowed(self):
        # SEC-06: restrictions are the seeders' rows; the POST (which refused only settings) is gone
        owner = self._create_user("owner@example.com", "Owner")
        self.client.force_authenticate(user=owner)

        response = self.client.post(
            "/api/restrictions/",
            {"type": "Setting", "restriction": "Tilea Setting"},
            format="json",
        )

        self.assertEqual(response.status_code, 405)
        self.assertEqual(Restriction.objects.filter(restriction="Tilea Setting").count(), 0)

    def test_players_returns_members(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner, max_players=3)
        join_code = campaign["join_code"]

        player = self._create_user("player@example.com", "Player")
        self.client.force_authenticate(user=player)
        join_response = self.client.post(
            "/api/campaigns/join/",
            {"join_code": join_code},
            format="json",
        )
        self.assertEqual(join_response.status_code, 201)

        self.client.force_authenticate(user=owner)
        response = self.client.get(f"/api/campaigns/{campaign['id']}/players/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_players_marks_battle_busy_members(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner, max_players=3)
        join_code = campaign["join_code"]

        player = self._create_user("player@example.com", "Player")
        self.client.force_authenticate(user=player)
        join_response = self.client.post(
            "/api/campaigns/join/",
            {"join_code": join_code},
            format="json",
        )
        self.assertEqual(join_response.status_code, 201)

        Warband.objects.create(
            campaign_id=campaign["id"],
            user=owner,
            name="Iron Vultures",
        )
        Warband.objects.create(
            campaign_id=campaign["id"],
            user=player,
            name="Night Razors",
        )

        battle = Battle.objects.create(
            campaign_id=campaign["id"],
            created_by_user=owner,
            scenario="Street Fight",
            status=Battle.STATUS_PREBATTLE,
        )
        BattleParticipant.objects.create(
            battle=battle,
            user=owner,
            warband=Warband.objects.get(campaign_id=campaign["id"], user=owner),
            status=BattleParticipant.STATUS_READY,
        )
        BattleParticipant.objects.create(
            battle=battle,
            user=player,
            warband=Warband.objects.get(campaign_id=campaign["id"], user=player),
            status=BattleParticipant.STATUS_INVITED,
        )

        self.client.force_authenticate(user=owner)
        response = self.client.get(f"/api/campaigns/{campaign['id']}/players/")
        self.assertEqual(response.status_code, 200)
        owner_entry = next(entry for entry in response.data if entry["id"] == owner.id)
        player_entry = next(entry for entry in response.data if entry["id"] == player.id)
        self.assertTrue(owner_entry["battle_busy"])
        self.assertEqual(owner_entry["battle_busy_status"], "prebattle")
        self.assertTrue(player_entry["battle_busy"])
        self.assertEqual(player_entry["battle_busy_status"], "prebattle")

    def test_battle_history_returns_ended_battles_with_aggregates_and_short_dates(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner, max_players=3)
        join_code = campaign["join_code"]

        player = self._create_user("player@example.com", "Player")
        self.client.force_authenticate(user=player)
        join_response = self.client.post(
            "/api/campaigns/join/",
            {"join_code": join_code},
            format="json",
        )
        self.assertEqual(join_response.status_code, 201)

        owner_warband = Warband.objects.create(
            campaign_id=campaign["id"],
            user=owner,
            name="Iron Vultures",
        )
        player_warband = Warband.objects.create(
            campaign_id=campaign["id"],
            user=player,
            name="Night Razors",
        )

        normal_battle = Battle.objects.create(
            campaign_id=campaign["id"],
            created_by_user=owner,
            scenario="Street Fight",
            flow_type=Battle.FLOW_TYPE_NORMAL,
            status=Battle.STATUS_ENDED,
            ended_at=datetime(2026, 3, 24, 18, 30, tzinfo=UTC),
            winner_warband_ids_json=[owner_warband.id],
        )
        for voided in (None, None, None, datetime(2026, 3, 24, 18, 0, tzinfo=UTC)):  # its kills (next step 9)
            event = BattleEvent.objects.create(battle=normal_battle, type=BattleEvent.TYPE_UNIT_KILL_RECORDED)
            BattleKill.objects.create(
                battle=normal_battle,
                campaign_id=campaign["id"],
                event=event,
                phase="fight",
                voided_at=voided,  # an undone kill counts nowhere
                killer_warband=owner_warband,
                killer_kind="hero",
                victim_kind="someone_else",
            )
        BattleParticipant.objects.create(
            battle=normal_battle,
            user=owner,
            warband=owner_warband,
            status=BattleParticipant.STATUS_CONFIRMED_POSTBATTLE,
            postbattle_json={
                "exploration": {"dice_values": [4, 5], "resource_id": 1},
                "unit_results": {
                    "hero:1": {
                        "unit_name": "Captain Wolf",
                        "out_of_action": True,
                        "kill_count": 2,
                        "xp_earned": 4,
                        "dead": False,
                    },
                    "henchman:1": {
                        "unit_name": "Blade 1",
                        "out_of_action": False,
                        "kill_count": 1,
                        "xp_earned": 2,
                        "dead": True,
                    },
                },
            },
        )
        BattleParticipant.objects.create(
            battle=normal_battle,
            user=player,
            warband=player_warband,
            status=BattleParticipant.STATUS_CONFIRMED_POSTBATTLE,
            postbattle_json={
                "exploration": {"dice_values": [], "resource_id": None},
                "unit_results": {
                    "hero:2": {
                        "unit_name": "Night Claw",
                        "out_of_action": True,
                        "kill_count": 0,
                        "xp_earned": 1,
                        "dead": False,
                    }
                },
            },
        )

        reported_battle = Battle.objects.create(
            campaign_id=campaign["id"],
            created_by_user=owner,
            scenario="Ambush",
            flow_type=Battle.FLOW_TYPE_REPORTED_RESULT,
            status=Battle.STATUS_ENDED,
            ended_at=datetime(2026, 3, 23, 11, 0, tzinfo=UTC),
            winner_warband_ids_json=[player_warband.id],
        )
        BattleParticipant.objects.create(
            battle=reported_battle,
            user=owner,
            warband=owner_warband,
            status=BattleParticipant.STATUS_REPORTED_RESULT_APPROVED,
            postbattle_json={},
        )
        BattleParticipant.objects.create(
            battle=reported_battle,
            user=player,
            warband=player_warband,
            status=BattleParticipant.STATUS_REPORTED_RESULT_APPROVED,
            postbattle_json={},
        )

        canceled_battle = Battle.objects.create(
            campaign_id=campaign["id"],
            created_by_user=owner,
            scenario="Canceled Clash",
            flow_type=Battle.FLOW_TYPE_NORMAL,
            status=Battle.STATUS_CANCELED,
            ended_at=datetime(2026, 3, 22, 11, 0, tzinfo=UTC),
        )
        BattleParticipant.objects.create(
            battle=canceled_battle,
            user=owner,
            warband=owner_warband,
            status=BattleParticipant.STATUS_CANCELED_PREBATTLE,
        )

        self.client.force_authenticate(user=owner)
        response = self.client.get(f"/api/campaigns/{campaign['id']}/battle-history/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

        latest_entry = response.data[0]
        self.assertEqual(latest_entry["scenario"], "Street Fight")
        self.assertEqual(latest_entry["winners"], [owner_warband.name])
        self.assertEqual(latest_entry["date"], "24/03/26")
        self.assertEqual(len(latest_entry["participants"]), 2)

        owner_entry = next(entry for entry in latest_entry["participants"] if entry["warband_id"] == owner_warband.id)
        self.assertEqual(owner_entry["warband_name"], owner_warband.name)
        self.assertEqual(owner_entry["kills"], 3)
        self.assertEqual(owner_entry["ooas"], 1)
        self.assertEqual(owner_entry["deaths"], ["Blade 1"])
        self.assertEqual(owner_entry["xp_gain"], 6)
        self.assertEqual(owner_entry["exploration"], [4, 5])

        reported_entry = response.data[1]
        self.assertEqual(reported_entry["scenario"], "Ambush")
        self.assertEqual(reported_entry["winners"], [player_warband.name])
        self.assertEqual(reported_entry["date"], "23/03/26")
        blank_owner_entry = next(
            entry for entry in reported_entry["participants"] if entry["warband_id"] == owner_warband.id
        )
        self.assertIsNone(blank_owner_entry["kills"])
        self.assertIsNone(blank_owner_entry["ooas"])
        self.assertEqual(blank_owner_entry["deaths"], [])
        self.assertIsNone(blank_owner_entry["xp_gain"])
        self.assertEqual(blank_owner_entry["exploration"], [])

    def test_top_killers_returns_cross_unit_leaders_sorted_and_limited(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner, max_players=3)
        join_code = campaign["join_code"]

        player = self._create_user("player@example.com", "Player")
        self.client.force_authenticate(user=player)
        join_response = self.client.post(
            "/api/campaigns/join/",
            {"join_code": join_code},
            format="json",
        )
        self.assertEqual(join_response.status_code, 201)

        other_owner = self._create_user("other@example.com", "Other")
        other_campaign = self._create_campaign(other_owner, name="Other Campaign")

        owner_warband = Warband.objects.create(
            campaign_id=campaign["id"],
            user=owner,
            name="Iron Vultures",
        )
        player_warband = Warband.objects.create(
            campaign_id=campaign["id"],
            user=player,
            name="Night Razors",
        )
        other_warband = Warband.objects.create(
            campaign_id=other_campaign["id"],
            user=other_owner,
            name="Outsiders",
        )

        top_hero = Hero.objects.create(warband=owner_warband, name="Captain Wolf", unit_type="Captain", kills=9)
        Hireling.objects.create(warband=owner_warband, name="Ogre Bodyguard", unit_type="Ogre", kills=7)
        Hero.objects.create(warband=owner_warband, name="Zero Hero", unit_type="Youngblood", kills=0)

        group = HenchmenGroup.objects.create(warband=player_warband, name="Black Knives", unit_type="Thugs")
        Henchman.objects.create(group=group, name="Blade One", kills=8)
        Henchman.objects.create(group=group, name="Blade Two", kills=7)

        Hireling.objects.create(warband=player_warband, name="Albrecht", unit_type="Warlock", kills=7)
        Hero.objects.create(warband=player_warband, name="Boris", unit_type="Champion", kills=6)
        Hero.objects.create(warband=player_warband, name="Celia", unit_type="Champion", kills=5)
        Hero.objects.create(warband=other_warband, name="Foreign Killer", unit_type="Vampire", kills=99)

        self.client.force_authenticate(user=owner)
        response = self.client.get(f"/api/campaigns/{campaign['id']}/top-killers/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["top_killers"]), 5)

        first_entry = response.data["top_killers"][0]
        self.assertEqual(first_entry["unit_id"], top_hero.id)
        self.assertEqual(first_entry["unit_kind"], "hero")
        self.assertEqual(first_entry["unit_name"], "Captain Wolf")
        self.assertEqual(first_entry["unit_type"], "Captain")
        self.assertEqual(first_entry["warband_id"], owner_warband.id)
        self.assertEqual(first_entry["warband_name"], owner_warband.name)
        self.assertEqual(first_entry["kills"], 9)

        unit_names = [entry["unit_name"] for entry in response.data["top_killers"]]
        self.assertEqual(
            unit_names,
            ["Captain Wolf", "Blade One", "Albrecht", "Blade Two", "Ogre Bodyguard"],
        )
        self.assertNotIn("Zero Hero", unit_names)
        self.assertNotIn("Foreign Killer", unit_names)

    def test_top_killers_returns_empty_list_when_no_kills_exist(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)

        warband = Warband.objects.create(
            campaign_id=campaign["id"],
            user=owner,
            name="Iron Vultures",
        )
        Hero.objects.create(warband=warband, name="Captain Wolf", unit_type="Captain", kills=0)
        group = HenchmenGroup.objects.create(warband=warband, name="Black Knives", unit_type="Thugs")
        Henchman.objects.create(group=group, name="Blade One", kills=0)

        self.client.force_authenticate(user=owner)
        response = self.client.get(f"/api/campaigns/{campaign['id']}/top-killers/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"top_killers": []})

    def test_top_killers_requires_membership(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)

        outsider = self._create_user("outsider@example.com", "Outsider")
        self.client.force_authenticate(user=outsider)
        response = self.client.get(f"/api/campaigns/{campaign['id']}/top-killers/")
        self.assertEqual(response.status_code, 404)

    def test_bulletin_entry_create_list_and_delete_flow(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner, max_players=3)
        join_code = campaign["join_code"]

        player = self._create_user("player@example.com", "Player")
        self.client.force_authenticate(user=player)
        join_response = self.client.post(
            "/api/campaigns/join/",
            {"join_code": join_code},
            format="json",
        )
        self.assertEqual(join_response.status_code, 201)

        self.client.force_authenticate(user=owner)
        first_response = self.client.post(
            f"/api/campaigns/{campaign['id']}/bulletin/",
            {"body": "  Looking for a sling and spare blade.  "},
            format="json",
        )
        self.assertEqual(first_response.status_code, 201)
        self.assertEqual(first_response.data["username"], "Owner")
        self.assertEqual(first_response.data["body"], "Looking for a sling and spare blade.")

        first_entry = CampaignBulletinEntry.objects.get(id=first_response.data["id"])
        self.assertEqual(first_entry.username, "Owner")
        self.assertEqual(first_entry.body, "Looking for a sling and spare blade.")

        self.client.force_authenticate(user=player)
        second_response = self.client.post(
            f"/api/campaigns/{campaign['id']}/bulletin/",
            {"body": "WTB wyrdstone map fragments"},
            format="json",
        )
        self.assertEqual(second_response.status_code, 201)

        list_response = self.client.get(f"/api/campaigns/{campaign['id']}/bulletin/")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(
            [entry["id"] for entry in list_response.data],
            [second_response.data["id"], first_response.data["id"]],
        )

        delete_response = self.client.delete(f"/api/campaigns/{campaign['id']}/bulletin/{second_response.data['id']}/")
        self.assertEqual(delete_response.status_code, 204)
        removed = CampaignBulletinEntry.objects.get(id=second_response.data["id"])  # a soft delete (decision 8)
        self.assertEqual(removed.removed_by_id, player.id)

    def test_bulletin_entry_rejects_blank_or_over_limit_body(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)

        self.client.force_authenticate(user=owner)
        blank_response = self.client.post(
            f"/api/campaigns/{campaign['id']}/bulletin/",
            {"body": "   "},
            format="json",
        )
        self.assertEqual(blank_response.status_code, 400)
        self.assertEqual(blank_response.data["body"][0], "Bulletin body is required.")

        over_limit_response = self.client.post(
            f"/api/campaigns/{campaign['id']}/bulletin/",
            {"body": "x" * 281},
            format="json",
        )
        self.assertEqual(over_limit_response.status_code, 400)
        self.assertEqual(
            over_limit_response.data["body"][0],
            "Bulletin body must be 280 characters or fewer.",
        )

    def test_bulletin_entry_delete_requires_ownership(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner, max_players=3)
        join_code = campaign["join_code"]

        player = self._create_user("player@example.com", "Player")
        outsider = self._create_user("outsider@example.com", "Outsider")
        self.client.force_authenticate(user=player)
        join_response = self.client.post(
            "/api/campaigns/join/",
            {"join_code": join_code},
            format="json",
        )
        self.assertEqual(join_response.status_code, 201)

        self.client.force_authenticate(user=owner)
        create_response = self.client.post(
            f"/api/campaigns/{campaign['id']}/bulletin/",
            {"body": "Need a lucky rabbit's foot."},
            format="json",
        )
        entry_id = create_response.data["id"]

        self.client.force_authenticate(user=player)
        foreign_delete_response = self.client.delete(f"/api/campaigns/{campaign['id']}/bulletin/{entry_id}/")
        self.assertEqual(foreign_delete_response.status_code, 403)
        self.assertTrue(CampaignBulletinEntry.objects.filter(id=entry_id).exists())

        self.client.force_authenticate(user=outsider)
        outsider_list_response = self.client.get(f"/api/campaigns/{campaign['id']}/bulletin/")
        self.assertEqual(outsider_list_response.status_code, 404)

    def test_encampment_create_list_and_patch_flow(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner, pages=True)
        player = self._create_user("player@example.com", "Player")

        self.client.force_authenticate(user=player)
        join_response = self.client.post(
            "/api/campaigns/join/",
            {"join_code": campaign["join_code"]},
            format="json",
        )
        self.assertEqual(join_response.status_code, 201)

        self.client.force_authenticate(user=owner)
        create_response = self.client.post(
            f"/api/campaigns/{campaign['id']}/encampments/",
            {
                "name": "Dockside Camp",
                "owner_id": player.id,
                "description": "Trade route staging point.",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.data["owner_id"], player.id)
        self.assertEqual(create_response.data["owner_name"], "Player")

        list_response = self.client.get(f"/api/campaigns/{campaign['id']}/encampments/")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]["id"], create_response.data["id"])

        patch_response = self.client.patch(
            f"/api/campaigns/{campaign['id']}/encampments/{create_response.data['id']}/",
            {"description": "Updated camp notes.", "owner_id": owner.id},
            format="json",
        )
        self.assertEqual(patch_response.status_code, 200)
        self.assertEqual(patch_response.data["owner_id"], owner.id)
        self.assertEqual(patch_response.data["owner_name"], "Owner")
        self.assertEqual(patch_response.data["description"], "Updated camp notes.")

        encampment = CampaignEncampment.objects.get(id=create_response.data["id"])
        self.assertEqual(encampment.owner_id, owner.id)
        self.assertEqual(encampment.description, "Updated camp notes.")

        other_campaign = self._create_campaign(owner, name="Other Marienburg", pages=True)
        other_encampment = CampaignEncampment.objects.create(
            campaign_id=other_campaign["id"],
            name="Foreign Camp",
            description="Should stay isolated.",
        )
        wrong_patch_response = self.client.patch(
            f"/api/campaigns/{campaign['id']}/encampments/{other_encampment.id}/",
            {"description": "Nope"},
            format="json",
        )
        self.assertEqual(wrong_patch_response.status_code, 404)

    def test_encampment_endpoints_require_feature_and_write_permission(self):
        owner = self._create_user("owner@example.com", "Owner")
        standard_campaign = self._create_campaign(owner)

        self.client.force_authenticate(user=owner)
        disabled_list_response = self.client.get(f"/api/campaigns/{standard_campaign['id']}/encampments/")
        self.assertEqual(disabled_list_response.status_code, 404)
        disabled_create_response = self.client.post(
            f"/api/campaigns/{standard_campaign['id']}/encampments/",
            {"name": "Not Yet"},
            format="json",
        )
        self.assertEqual(disabled_create_response.status_code, 404)

        campaign = self._create_campaign(owner, name="Enabled Encampments", pages=True)
        player = self._create_user("player@example.com", "Player")
        self.client.force_authenticate(user=player)
        join_response = self.client.post(
            "/api/campaigns/join/",
            {"join_code": campaign["join_code"]},
            format="json",
        )
        self.assertEqual(join_response.status_code, 201)

        list_response = self.client.get(f"/api/campaigns/{campaign['id']}/encampments/")
        self.assertEqual(list_response.status_code, 200)

        # decision 9: any member adds one (his own); someone else's needs manage_encampments
        own_create_response = self.client.post(
            f"/api/campaigns/{campaign['id']}/encampments/",
            {"name": "Player Camp"},
            format="json",
        )
        self.assertEqual((own_create_response.status_code, own_create_response.data["owner_id"]), (201, player.id))
        nobodys = CampaignEncampment.objects.create(campaign_id=campaign["id"], name="Nobody's Camp")
        nobodys_url = f"/api/campaigns/{campaign['id']}/encampments/{nobodys.id}/"
        self.assertEqual(self.client.patch(nobodys_url, {"name": "Mine"}, format="json").status_code, 403)

        self._grant_campaign_permission(campaign["id"], player, "manage_encampments")
        self.assertEqual(self.client.patch(nobodys_url, {"name": "Mine"}, format="json").status_code, 200)

    def test_location_create_list_and_patch_flow(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner, pages=True)

        self.client.force_authenticate(user=owner)
        create_response = self.client.post(
            f"/api/campaigns/{campaign['id']}/locations/",
            {
                "name": "River Quarter",
                "content": "<p>Main district text.</p>",
                "d6_1": "Collapsed bridge",
                "d6_6": "<strong>Secret route</strong>",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.data["content"], "<p>Main district text.</p>")
        self.assertEqual(create_response.data["d6_1"], "Collapsed bridge")
        self.assertEqual(create_response.data["d6_6"], "<strong>Secret route</strong>")

        list_response = self.client.get(f"/api/campaigns/{campaign['id']}/locations/")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]["id"], create_response.data["id"])

        patch_response = self.client.patch(
            f"/api/campaigns/{campaign['id']}/locations/{create_response.data['id']}/",
            {"d6_2": "Canal ambush", "content": "<p>Updated text.</p>"},
            format="json",
        )
        self.assertEqual(patch_response.status_code, 200)
        self.assertEqual(patch_response.data["d6_2"], "Canal ambush")
        self.assertEqual(patch_response.data["content"], "<p>Updated text.</p>")

        location = CampaignLocation.objects.get(id=create_response.data["id"])
        self.assertEqual(location.d6_2, "Canal ambush")
        self.assertEqual(location.content, "<p>Updated text.</p>")

        other_campaign = self._create_campaign(owner, name="Other Locations", pages=True)
        other_location = CampaignLocation.objects.create(campaign_id=other_campaign["id"], name="Elsewhere")
        wrong_patch_response = self.client.patch(
            f"/api/campaigns/{campaign['id']}/locations/{other_location.id}/",
            {"name": "Nope"},
            format="json",
        )
        self.assertEqual(wrong_patch_response.status_code, 404)

    def test_location_endpoints_require_feature_and_write_permission(self):
        owner = self._create_user("owner@example.com", "Owner")
        standard_campaign = self._create_campaign(owner)

        self.client.force_authenticate(user=owner)
        disabled_list_response = self.client.get(f"/api/campaigns/{standard_campaign['id']}/locations/")
        self.assertEqual(disabled_list_response.status_code, 404)
        disabled_create_response = self.client.post(
            f"/api/campaigns/{standard_campaign['id']}/locations/",
            {"name": "Not Yet"},
            format="json",
        )
        self.assertEqual(disabled_create_response.status_code, 404)

        campaign = self._create_campaign(owner, name="Enabled Locations", pages=True)
        player = self._create_user("player@example.com", "Player")
        self.client.force_authenticate(user=player)
        join_response = self.client.post(
            "/api/campaigns/join/",
            {"join_code": campaign["join_code"]},
            format="json",
        )
        self.assertEqual(join_response.status_code, 201)

        list_response = self.client.get(f"/api/campaigns/{campaign['id']}/locations/")
        self.assertEqual(list_response.status_code, 200)

        forbidden_create_response = self.client.post(
            f"/api/campaigns/{campaign['id']}/locations/",
            {"name": "Player Location"},
            format="json",
        )
        self.assertEqual(forbidden_create_response.status_code, 403)

        self._grant_campaign_permission(campaign["id"], player, "manage_locations")
        allowed_create_response = self.client.post(
            f"/api/campaigns/{campaign['id']}/locations/",
            {"name": "Player Location", "d6_3": "Lucky find"},
            format="json",
        )
        self.assertEqual(allowed_create_response.status_code, 201)
        self.assertEqual(allowed_create_response.data["d6_3"], "Lucky find")

    def test_member_permissions_require_admin_or_owner(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)

        admin_user = self._create_user("admin@example.com", "Admin")
        target_user = self._create_user("player@example.com", "Player")
        admin_role = CampaignRole.objects.get(slug="admin")
        player_role = CampaignRole.objects.get(slug="player")
        CampaignMembership.objects.create(campaign_id=campaign["id"], user=admin_user, role=admin_role)
        CampaignMembership.objects.create(campaign_id=campaign["id"], user=target_user, role=player_role)

        self.client.force_authenticate(user=target_user)
        response = self.client.put(
            f"/api/campaigns/{campaign['id']}/members/{target_user.id}/permissions/",
            {"permissions": ["delete_catalogue"]},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(user=admin_user)
        response = self.client.put(
            f"/api/campaigns/{campaign['id']}/members/{target_user.id}/permissions/",
            {"permissions": ["delete_catalogue"]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["code"], "delete_catalogue")

        self.client.force_authenticate(user=owner)
        response = self.client.put(
            f"/api/campaigns/{campaign['id']}/members/{target_user.id}/permissions/",
            {"permissions": ["delete_catalogue"]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["code"], "delete_catalogue")
