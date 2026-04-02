from django.contrib.auth import get_user_model
from datetime import datetime, timezone as dt_timezone
from django.core.cache import cache
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient, APITestCase

from apps.battles.models import Battle, BattleParticipant
from apps.campaigns.models import CampaignMembership, CampaignRole, CampaignSettings, PivotalMoment
from apps.items.models import (
    Item,
    ItemAvailability,
    ItemAvailabilityRestriction,
    ItemProperty,
    ItemPropertyLink,
)
from apps.restrictions.models import Restriction
from apps.campaigns.views import _ensure_permissions, _ensure_roles
from apps.warbands.models import (
    Henchman,
    HenchmenGroup,
    HenchmenGroupItem,
    Hero,
    HeroItem,
    HiredSword,
    HiredSwordItem,
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
        _ensure_roles.cache_clear()
        _ensure_permissions.cache_clear()

    def _create_user(self, email, name=""):
        return self.user_model.objects.create_user(
            username=email,
            email=email,
            password=self.password,
            first_name=name,
        )

    def _create_campaign(self, user, name="Shards of the Comet", max_players=6):
        self.client.force_authenticate(user=user)
        response = self.client.post(
            "/api/campaigns/",
            {
                "name": name,
                "max_players": max_players,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        return response.data

    def _create_setting(self, name="Cathay Setting"):
        return Restriction.objects.create(type="Setting", restriction=name)

    def _create_warband_restriction(self, name="Reiklanders"):
        return Restriction.objects.create(type="Warband", restriction=name)

    def _create_base_item(
        self,
        name,
        *,
        subtype="Armour",
        grade="1a",
        cost=50,
        rarity=8,
        description="",
        save_value="5+",
        variable_cost=None,
        restriction_links=None,
        properties=None,
    ):
        item = Item.objects.create(
            name=name,
            type="Armour",
            subtype=subtype,
            grade=grade,
            description=description,
            save_value=save_value,
        )
        availability = ItemAvailability.objects.create(
            item=item,
            cost=cost,
            rarity=rarity,
            variable_cost=variable_cost,
        )
        for restriction, note in restriction_links or []:
            ItemAvailabilityRestriction.objects.create(
                item_availability=availability,
                restriction=restriction,
                additional_note=note,
            )
        for prop in properties or []:
            ItemPropertyLink.objects.create(item=item, property=prop)
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

    def test_create_campaign_persists_item_settings(self):
        owner = self._create_user("owner@example.com", "Owner")
        cathay = self._create_setting("Cathay Setting")
        khemri = self._create_setting("Khemri Setting")

        self.client.force_authenticate(user=owner)
        response = self.client.post(
            "/api/campaigns/",
            {
                "name": "Ashes",
                "max_players": 6,
                "item_setting_ids": [cathay.id, khemri.id],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            [entry["restriction"] for entry in response.data["item_settings"]],
            ["Cathay Setting", "Khemri Setting"],
        )
        settings = CampaignSettings.objects.get(campaign_id=response.data["id"])
        self.assertEqual(
            list(settings.item_settings.order_by("restriction").values_list("restriction", flat=True)),
            ["Cathay Setting", "Khemri Setting"],
        )

    def test_patch_campaign_updates_item_settings(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)
        cathay = self._create_setting("Cathay Setting")
        nehekharan = self._create_setting("Nehekharan Setting")

        self.client.force_authenticate(user=owner)
        response = self.client.patch(
            f"/api/campaigns/{campaign['id']}/",
            {"item_setting_ids": [nehekharan.id, cathay.id]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [entry["restriction"] for entry in response.data["item_settings"]],
            ["Cathay Setting", "Nehekharan Setting"],
        )

    def test_create_half_price_armour_rule_creates_discounted_campaign_clones(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)
        restriction = self._create_setting("Nobles")
        property_entry = ItemProperty.objects.create(name="Bulky", type="Armour", description="Very heavy.")
        heavy_armour = self._create_base_item(
            "Heavy Armour",
            cost=51,
            rarity=9,
            description="Heavy suit",
            save_value="5+",
            restriction_links=[(restriction, "Only nobles")],
            properties=[property_entry],
        )
        chaos_armour = self._create_base_item(
            "Chaos Armour",
            grade="1c",
            cost=185,
            rarity=11,
            description="Warp-forged plate",
            save_value="4+",
        )
        self._create_base_item("Shield", subtype="Shield", cost=5, rarity=2, save_value="")

        response = self._create_half_price_armour_rule(owner, campaign["id"])

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["effect_key"], "half_price_armour")

        clones = Item.objects.filter(
            campaign_id=campaign["id"],
            generated_effect_key="half_price_armour",
        ).select_related("source_item")
        self.assertEqual(clones.count(), 2)
        self.assertFalse(clones.filter(source_item__subtype="Shield").exists())

        heavy_clone = clones.get(source_item=heavy_armour)
        self.assertEqual(heavy_clone.name, heavy_armour.name)
        self.assertEqual(heavy_clone.type, heavy_armour.type)
        self.assertEqual(heavy_clone.subtype, heavy_armour.subtype)
        self.assertEqual(heavy_clone.grade, heavy_armour.grade)
        self.assertEqual(heavy_clone.description, heavy_armour.description)
        self.assertEqual(heavy_clone.save_value, heavy_armour.save_value)
        self.assertEqual(heavy_clone.source_item_id, heavy_armour.id)

        heavy_clone_availability = heavy_clone.availabilities.get()
        self.assertEqual(heavy_clone_availability.cost, 26)
        self.assertEqual(heavy_clone_availability.rarity, 9)
        self.assertEqual(
            list(
                heavy_clone_availability.restriction_links.order_by("id").values_list(
                    "restriction__restriction",
                    "additional_note",
                )
            ),
            [("Nobles", "Only nobles")],
        )
        self.assertEqual(
            list(heavy_clone.property_links.values_list("property__name", flat=True)),
            ["Bulky"],
        )

        chaos_clone = clones.get(source_item=chaos_armour)
        self.assertEqual(chaos_clone.availabilities.get().cost, 93)

    def test_creating_half_price_armour_rule_twice_is_idempotent_for_generated_items(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)
        source_item = self._create_base_item("Light Armour", cost=20, rarity=8)

        first_response = self._create_half_price_armour_rule(owner, campaign["id"])
        second_response = self._create_half_price_armour_rule(owner, campaign["id"], title="Half Price Armour Copy")

        self.assertEqual(first_response.status_code, 201)
        self.assertEqual(second_response.status_code, 201)
        clones = Item.objects.filter(
            campaign_id=campaign["id"],
            generated_effect_key="half_price_armour",
            source_item=source_item,
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
            faction="Mercenaries",
        )
        hero = Hero.objects.create(warband=warband, name="Captain", unit_type="Leader")
        hired_sword = HiredSword.objects.create(warband=warband, name="Scout", unit_type="Ranger")
        group = HenchmenGroup.objects.create(warband=warband, name="Youngbloods", unit_type="Mercenary")
        WarbandItem.objects.create(warband=warband, item=armour, quantity=2, cost=91)
        HeroItem.objects.create(hero=hero, item=armour, cost=91)
        HiredSwordItem.objects.create(hired_sword=hired_sword, item=armour, cost=91)
        HenchmenGroupItem.objects.create(henchmen_group=group, item=armour, cost=91)

        response = self._create_half_price_armour_rule(owner, campaign["id"])

        self.assertEqual(response.status_code, 201)
        clone = Item.objects.get(
            campaign_id=campaign["id"],
            generated_effect_key="half_price_armour",
            source_item=armour,
        )
        self.assertEqual(WarbandItem.objects.get(warband=warband).item_id, clone.id)
        self.assertEqual(WarbandItem.objects.get(warband=warband).cost, 46)
        self.assertEqual(HeroItem.objects.get(hero=hero).item_id, clone.id)
        self.assertEqual(HeroItem.objects.get(hero=hero).cost, 46)
        self.assertEqual(HiredSwordItem.objects.get(hired_sword=hired_sword).item_id, clone.id)
        self.assertEqual(HiredSwordItem.objects.get(hired_sword=hired_sword).cost, 46)
        self.assertEqual(HenchmenGroupItem.objects.get(henchmen_group=group).item_id, clone.id)
        self.assertEqual(HenchmenGroupItem.objects.get(henchmen_group=group).cost, 46)

    def test_delete_half_price_armour_rule_restores_owned_items_and_removes_clones(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)
        armour = self._create_base_item("Gromril Armour", cost=150, rarity=11)
        warband = Warband.objects.create(
            campaign_id=campaign["id"],
            user=owner,
            name="Steel Faith",
            faction="Dwarfs",
        )
        hero = Hero.objects.create(warband=warband, name="Noble", unit_type="Hero")
        WarbandItem.objects.create(warband=warband, item=armour, quantity=1, cost=150)
        HeroItem.objects.create(hero=hero, item=armour, cost=150)

        create_response = self._create_half_price_armour_rule(owner, campaign["id"])
        rule_id = create_response.data["id"]
        clone = Item.objects.get(
            campaign_id=campaign["id"],
            generated_effect_key="half_price_armour",
            source_item=armour,
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
            faction="Cathay",
        )
        WarbandItem.objects.create(warband=warband, item=armour, quantity=1, cost=120)

        create_response = self._create_half_price_armour_rule(owner, campaign["id"])
        rule_id = create_response.data["id"]
        clone = Item.objects.get(
            campaign_id=campaign["id"],
            generated_effect_key="half_price_armour",
            source_item=armour,
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
        ).select_related("source_item")
        self.assertEqual(clones.count(), 3)

        shield_clone = clones.get(source_item=shield)
        self.assertEqual(shield_clone.save_value, "6+ (5+ CC)")
        self.assertEqual(shield_clone.availabilities.get().cost, 5)

        pavise_clone = clones.get(source_item=pavise)
        self.assertEqual(pavise_clone.save_value, "6+ (5+ CC)")
        self.assertEqual(pavise_clone.availabilities.get().cost, 25)

        buckler_clone = clones.get(source_item=buckler)
        self.assertEqual(buckler_clone.save_value, "")

    def test_create_improved_shields_rule_remaps_owned_items_to_shield_clones(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)
        shield = self._create_base_item("Shield", subtype="Shield", cost=5, rarity=2, save_value="6+")
        warband = Warband.objects.create(
            campaign_id=campaign["id"],
            user=owner,
            name="Wardens",
            faction="Mercenaries",
        )
        hero = Hero.objects.create(warband=warband, name="Captain", unit_type="Leader")
        WarbandItem.objects.create(warband=warband, item=shield, quantity=2, cost=5)
        HeroItem.objects.create(hero=hero, item=shield, cost=5)

        response = self._create_improved_shields_rule(owner, campaign["id"])

        self.assertEqual(response.status_code, 201)
        clone = Item.objects.get(
            campaign_id=campaign["id"],
            generated_effect_key="improved_shields",
            source_item=shield,
        )
        self.assertEqual(clone.save_value, "6+ (5+ CC)")
        self.assertEqual(WarbandItem.objects.get(warband=warband).item_id, clone.id)
        self.assertEqual(WarbandItem.objects.get(warband=warband).cost, 5)
        self.assertEqual(HeroItem.objects.get(hero=hero).item_id, clone.id)
        self.assertEqual(HeroItem.objects.get(hero=hero).cost, 5)

    def test_delete_improved_shields_rule_restores_owned_items_and_removes_shield_clones(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)
        shield = self._create_base_item("Kite Shield", subtype="Shield", grade="1c", cost=10, rarity=2, save_value="5+")
        warband = Warband.objects.create(
            campaign_id=campaign["id"],
            user=owner,
            name="Lances",
            faction="Bretonnians",
        )
        WarbandItem.objects.create(warband=warband, item=shield, quantity=1, cost=10)

        create_response = self._create_improved_shields_rule(owner, campaign["id"])
        rule_id = create_response.data["id"]
        clone = Item.objects.get(
            campaign_id=campaign["id"],
            generated_effect_key="improved_shields",
            source_item=shield,
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

    def test_warband_api_returns_effective_restrictions_from_campaign_item_settings(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)
        setting = self._create_setting("Cathay Setting")
        warband_restriction = self._create_warband_restriction("Reiklanders")

        self.client.force_authenticate(user=owner)
        patch_response = self.client.patch(
            f"/api/campaigns/{campaign['id']}/",
            {"item_setting_ids": [setting.id]},
            format="json",
        )
        self.assertEqual(patch_response.status_code, 200)

        create_response = self.client.post(
            "/api/warbands/",
            {
                "campaign_id": campaign["id"],
                "name": "Iron Vultures",
                "faction": "Mercenaries",
                "max_units": 15,
                "restriction_ids": [setting.id, warband_restriction.id],
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(
            [entry["restriction"] for entry in create_response.data["restrictions"]],
            ["Cathay Setting", "Reiklanders"],
        )

        warband = Warband.objects.get(id=create_response.data["id"])
        self.assertEqual(
            list(warband.restrictions.values_list("restriction", flat=True)),
            ["Reiklanders"],
        )

    def test_updating_warband_restrictions_preserves_campaign_item_settings(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)
        setting = self._create_setting("Cathay Setting")
        warband_restriction = self._create_warband_restriction("Reiklanders")

        self.client.force_authenticate(user=owner)
        self.client.patch(
            f"/api/campaigns/{campaign['id']}/",
            {"item_setting_ids": [setting.id]},
            format="json",
        )
        create_response = self.client.post(
            "/api/warbands/",
            {
                "campaign_id": campaign["id"],
                "name": "Iron Vultures",
                "faction": "Mercenaries",
                "max_units": 15,
                "restriction_ids": [warband_restriction.id],
            },
            format="json",
        )
        warband_id = create_response.data["id"]

        update_response = self.client.put(
            f"/api/warbands/{warband_id}/restrictions/",
            {"restriction_ids": []},
            format="json",
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(
            [entry["restriction"] for entry in update_response.data],
            ["Cathay Setting"],
        )

        update_response = self.client.put(
            f"/api/warbands/{warband_id}/restrictions/",
            {"restriction_ids": [setting.id, warband_restriction.id]},
            format="json",
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(
            [entry["restriction"] for entry in update_response.data],
            ["Cathay Setting", "Reiklanders"],
        )

    def test_campaign_warbands_endpoint_returns_effective_restrictions(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)
        setting = self._create_setting("Cathay Setting")
        warband_restriction = self._create_warband_restriction("Reiklanders")

        self.client.force_authenticate(user=owner)
        self.client.patch(
            f"/api/campaigns/{campaign['id']}/",
            {"item_setting_ids": [setting.id]},
            format="json",
        )
        create_response = self.client.post(
            "/api/warbands/",
            {
                "campaign_id": campaign["id"],
                "name": "Iron Vultures",
                "faction": "Mercenaries",
                "max_units": 15,
                "restriction_ids": [warband_restriction.id],
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)

        response = self.client.get(f"/api/campaigns/{campaign['id']}/warbands/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(
            [entry["restriction"] for entry in response.data[0]["restrictions"]],
            ["Cathay Setting", "Reiklanders"],
        )

    def test_posting_setting_restriction_is_rejected(self):
        owner = self._create_user("owner@example.com", "Owner")
        self.client.force_authenticate(user=owner)

        response = self.client.post(
            "/api/restrictions/",
            {"type": "Setting", "restriction": "Tilea Setting"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
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
            faction="Mercenaries",
        )
        Warband.objects.create(
            campaign_id=campaign["id"],
            user=player,
            name="Night Razors",
            faction="Skaven",
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
            faction="Mercenaries",
        )
        player_warband = Warband.objects.create(
            campaign_id=campaign["id"],
            user=player,
            name="Night Razors",
            faction="Skaven",
        )

        normal_battle = Battle.objects.create(
            campaign_id=campaign["id"],
            created_by_user=owner,
            scenario="Street Fight",
            flow_type=Battle.FLOW_TYPE_NORMAL,
            status=Battle.STATUS_ENDED,
            ended_at=datetime(2026, 3, 24, 18, 30, tzinfo=dt_timezone.utc),
            winner_warband_ids_json=[owner_warband.id],
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
            ended_at=datetime(2026, 3, 23, 11, 0, tzinfo=dt_timezone.utc),
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
            ended_at=datetime(2026, 3, 22, 11, 0, tzinfo=dt_timezone.utc),
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

        owner_entry = next(
            entry for entry in latest_entry["participants"] if entry["warband_id"] == owner_warband.id
        )
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

    def test_pivotal_moments_endpoint_returns_only_persisted_rows(self):
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
            faction="Mercenaries",
        )
        player_warband = Warband.objects.create(
            campaign_id=campaign["id"],
            user=player,
            name="Night Razors",
            faction="Skaven",
        )

        battle_without_rows = Battle.objects.create(
            campaign_id=campaign["id"],
            created_by_user=owner,
            scenario="Old Clash",
            flow_type=Battle.FLOW_TYPE_NORMAL,
            status=Battle.STATUS_ENDED,
            ended_at=datetime(2026, 3, 20, 12, 0, tzinfo=dt_timezone.utc),
            winner_warband_ids_json=[owner_warband.id],
        )
        BattleParticipant.objects.create(
            battle=battle_without_rows,
            user=owner,
            warband=owner_warband,
            status=BattleParticipant.STATUS_CONFIRMED_POSTBATTLE,
            postbattle_json={},
        )

        battle_with_row = Battle.objects.create(
            campaign_id=campaign["id"],
            created_by_user=owner,
            scenario="Street Fight",
            flow_type=Battle.FLOW_TYPE_NORMAL,
            status=Battle.STATUS_ENDED,
            ended_at=datetime(2026, 3, 24, 18, 30, tzinfo=dt_timezone.utc),
            winner_warband_ids_json=[owner_warband.id],
        )
        BattleParticipant.objects.create(
            battle=battle_with_row,
            user=owner,
            warband=owner_warband,
            status=BattleParticipant.STATUS_CONFIRMED_POSTBATTLE,
            postbattle_json={},
        )
        BattleParticipant.objects.create(
            battle=battle_with_row,
            user=player,
            warband=player_warband,
            status=BattleParticipant.STATUS_CONFIRMED_POSTBATTLE,
            postbattle_json={},
        )
        reported_battle_with_row = Battle.objects.create(
            campaign_id=campaign["id"],
            created_by_user=owner,
            scenario="Reported Result",
            flow_type=Battle.FLOW_TYPE_REPORTED_RESULT,
            status=Battle.STATUS_ENDED,
            ended_at=datetime(2026, 3, 25, 18, 30, tzinfo=dt_timezone.utc),
            winner_warband_ids_json=[player_warband.id],
        )
        BattleParticipant.objects.create(
            battle=reported_battle_with_row,
            user=owner,
            warband=owner_warband,
            status=BattleParticipant.STATUS_REPORTED_RESULT_APPROVED,
            postbattle_json={},
        )
        BattleParticipant.objects.create(
            battle=reported_battle_with_row,
            user=player,
            warband=player_warband,
            status=BattleParticipant.STATUS_REPORTED_RESULT_APPROVED,
            postbattle_json={},
        )
        moment = PivotalMoment.objects.create(
            campaign_id=campaign["id"],
            battle=battle_with_row,
            warband=owner_warband,
            kind="giant_slayer",
            headline="Giant Slayer",
            detail="Captain Wolf slew large target Ogre Mage.",
            unit_key="hero:1",
            unit_name="Captain Wolf",
            battle_ended_at=battle_with_row.ended_at,
        )
        with self.assertRaises(ValidationError):
            PivotalMoment.objects.create(
                campaign_id=campaign["id"],
                battle=reported_battle_with_row,
                warband=player_warband,
                kind="untouched_triumph",
                headline="Untouched Triumph",
                detail="Night Razors won without a single selected unit going out of action.",
                battle_ended_at=reported_battle_with_row.ended_at,
            )

        self.client.force_authenticate(user=owner)
        response = self.client.get(f"/api/campaigns/{campaign['id']}/pivotal-moments/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], moment.id)
        self.assertEqual(response.data[0]["headline"], "Giant Slayer")
        self.assertEqual(response.data[0]["warband_name"], owner_warband.name)
        self.assertEqual(response.data[0]["battle_scenario"], battle_with_row.scenario)
        self.assertEqual(response.data[0]["date"], "24/03/26")

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
            faction="Mercenaries",
        )
        player_warband = Warband.objects.create(
            campaign_id=campaign["id"],
            user=player,
            name="Night Razors",
            faction="Skaven",
        )
        other_warband = Warband.objects.create(
            campaign_id=other_campaign["id"],
            user=other_owner,
            name="Outsiders",
            faction="Undead",
        )

        top_hero = Hero.objects.create(warband=owner_warband, name="Captain Wolf", unit_type="Captain", kills=9)
        HiredSword.objects.create(warband=owner_warband, name="Ogre Bodyguard", unit_type="Ogre", kills=7)
        Hero.objects.create(warband=owner_warband, name="Zero Hero", unit_type="Youngblood", kills=0)

        group = HenchmenGroup.objects.create(warband=player_warband, name="Black Knives", unit_type="Thugs")
        Henchman.objects.create(group=group, name="Blade One", kills=8)
        Henchman.objects.create(group=group, name="Blade Two", kills=7)

        HiredSword.objects.create(warband=player_warband, name="Albrecht", unit_type="Warlock", kills=7)
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
            faction="Mercenaries",
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
            {"permissions": ["manage_items"]},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(user=admin_user)
        response = self.client.put(
            f"/api/campaigns/{campaign['id']}/members/{target_user.id}/permissions/",
            {"permissions": ["manage_items"]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["code"], "manage_items")

        self.client.force_authenticate(user=owner)
        response = self.client.put(
            f"/api/campaigns/{campaign['id']}/members/{target_user.id}/permissions/",
            {"permissions": ["manage_items"]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["code"], "manage_items")
