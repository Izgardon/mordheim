from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient, APITestCase

from apps.campaigns.models import Campaign, CampaignMembership, CampaignRole
from apps.items.models import Item, ItemAvailability
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


class WarbandsApiTests(APITestCase):
    client: APIClient

    def setUp(self):
        self.client = APIClient()
        cache.clear()
        self.user_model = get_user_model()
        self.password = "testpass123"

        self.owner_role = CampaignRole.objects.create(slug="owner", name="Owner")
        self.owner = self._create_user("owner@example.com", "Owner")
        self.campaign = Campaign.objects.create(name="Shadows Over Mordheim", join_code="ABC123")
        CampaignMembership.objects.create(
            campaign=self.campaign,
            user=self.owner,
            role=self.owner_role,
        )
        self.warband = Warband.objects.create(
            campaign=self.campaign,
            user=self.owner,
            name="Iron Vultures",
            faction="Mercenaries",
        )

        self.item = Item.objects.create(name="Sword", type="Weapon", description="")
        ItemAvailability.objects.create(item=self.item, cost=35, rarity=8)

        self.hero = Hero.objects.create(warband=self.warband, name="Captain Wolf", unit_type="Captain")
        self.hired_sword = HiredSword.objects.create(
            warband=self.warband,
            name="Ogre Bodyguard",
            unit_type="Ogre",
        )
        self.group = HenchmenGroup.objects.create(
            warband=self.warband,
            name="Black Knives",
            unit_type="Thugs",
        )
        Henchman.objects.create(group=self.group, name="Blade One")

        self.client.force_authenticate(user=self.owner)

    def _create_user(self, email, name=""):
        return self.user_model.objects.create_user(
            username=email,
            email=email,
            password=self.password,
            first_name=name,
        )

    def test_add_warband_item_defaults_cost_from_single_availability(self):
        response = self.client.post(
            f"/api/warbands/{self.warband.id}/items/",
            {
                "item_id": self.item.id,
                "quantity": 2,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["cost"], 35)
        self.assertEqual(response.data["quantity"], 2)
        self.assertEqual(
            WarbandItem.objects.get(warband=self.warband, item=self.item).cost,
            35,
        )

    def test_add_warband_item_keeps_explicit_cost(self):
        response = self.client.post(
            f"/api/warbands/{self.warband.id}/items/",
            {
                "item_id": self.item.id,
                "cost": 99,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["cost"], 99)
        self.assertEqual(
            WarbandItem.objects.get(warband=self.warband, item=self.item).cost,
            99,
        )

    def test_patch_hero_items_defaults_cost_from_single_availability(self):
        response = self.client.patch(
            f"/api/warbands/{self.warband.id}/heroes/{self.hero.id}/",
            {
                "items": [{"id": self.item.id}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["items"][0]["cost"], 35)
        self.assertEqual(
            HeroItem.objects.get(hero=self.hero, item=self.item).cost,
            35,
        )

    def test_patch_hero_items_keeps_explicit_cost(self):
        response = self.client.patch(
            f"/api/warbands/{self.warband.id}/heroes/{self.hero.id}/",
            {
                "items": [{"id": self.item.id, "cost": 77}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["items"][0]["cost"], 77)
        self.assertEqual(
            HeroItem.objects.get(hero=self.hero, item=self.item).cost,
            77,
        )

    def test_patch_henchmen_group_items_defaults_cost_from_single_availability(self):
        response = self.client.patch(
            f"/api/warbands/{self.warband.id}/henchmen-groups/{self.group.id}/",
            {
                "items": [{"id": self.item.id}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["items"][0]["cost"], 35)
        self.assertEqual(
            HenchmenGroupItem.objects.get(henchmen_group=self.group, item=self.item).cost,
            35,
        )

    def test_patch_hired_sword_items_defaults_cost_from_single_availability(self):
        response = self.client.patch(
            f"/api/warbands/{self.warband.id}/hired-swords/{self.hired_sword.id}/",
            {
                "items": [{"id": self.item.id}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["items"][0]["cost"], 35)
        self.assertEqual(
            HiredSwordItem.objects.get(hired_sword=self.hired_sword, item=self.item).cost,
            35,
        )

    def test_create_hired_sword_with_seeded_xp_starts_without_level_ups(self):
        response = self.client.post(
            f"/api/warbands/{self.warband.id}/hired-swords/",
            {
                "name": "Warlock",
                "unit_type": "Caster",
                "xp": 5,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["xp"], 5)
        self.assertEqual(response.data["level_up"], 0)
        created = HiredSword.objects.get(id=response.data["id"])
        self.assertEqual(created.level_up, 0)

    def test_patch_hired_sword_xp_gain_adds_level_ups_for_existing_unit(self):
        response = self.client.patch(
            f"/api/warbands/{self.warband.id}/hired-swords/{self.hired_sword.id}/",
            {
                "xp": 5,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["level_up"], 2)
        self.hired_sword.refresh_from_db()
        self.assertEqual(self.hired_sword.level_up, 2)

    def test_patch_hired_sword_with_explicit_level_up_seed_suppresses_increment(self):
        response = self.client.patch(
            f"/api/warbands/{self.warband.id}/hired-swords/{self.hired_sword.id}/",
            {
                "xp": 5,
                "level_up": 0,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["level_up"], 0)
        self.hired_sword.refresh_from_db()
        self.assertEqual(self.hired_sword.level_up, 0)

    def test_patch_hired_sword_no_level_ups_suppresses_increment(self):
        response = self.client.patch(
            f"/api/warbands/{self.warband.id}/hired-swords/{self.hired_sword.id}/",
            {
                "xp": 5,
                "no_level_ups": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["no_level_ups"])
        self.assertEqual(response.data["level_up"], 0)
        self.hired_sword.refresh_from_db()
        self.assertTrue(self.hired_sword.no_level_ups)
        self.assertEqual(self.hired_sword.level_up, 0)

    def test_hired_sword_level_up_endpoint_rejects_no_level_ups_units(self):
        self.hired_sword.level_up = 2
        self.hired_sword.no_level_ups = True
        self.hired_sword.save(update_fields=["level_up", "no_level_ups"])

        response = self.client.post(
            f"/api/warbands/{self.warband.id}/hired-swords/{self.hired_sword.id}/level-up/",
            {
                "payload": {
                    "advance": {
                        "id": "WS",
                        "label": "Weapon Skill",
                    }
                }
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "No level ups available")

    def test_create_henchmen_group_with_seeded_xp_starts_without_level_ups(self):
        response = self.client.post(
            f"/api/warbands/{self.warband.id}/henchmen-groups/",
            {
                "name": "Night Runners",
                "unit_type": "Skaven",
                "xp": 5,
                "henchmen": [{"name": "Sneak"}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["xp"], 5)
        self.assertEqual(response.data["level_up"], 0)
        created = HenchmenGroup.objects.get(id=response.data["id"])
        self.assertEqual(created.level_up, 0)

    def test_patch_henchmen_group_xp_gain_adds_level_ups_for_existing_group(self):
        response = self.client.patch(
            f"/api/warbands/{self.warband.id}/henchmen-groups/{self.group.id}/",
            {
                "xp": 5,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["level_up"], 2)
        self.group.refresh_from_db()
        self.assertEqual(self.group.level_up, 2)

    def test_patch_henchmen_group_with_explicit_level_up_seed_suppresses_increment(self):
        response = self.client.patch(
            f"/api/warbands/{self.warband.id}/henchmen-groups/{self.group.id}/",
            {
                "xp": 5,
                "level_up": 0,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["level_up"], 0)
        self.group.refresh_from_db()
        self.assertEqual(self.group.level_up, 0)

    def test_patch_henchmen_group_no_level_ups_suppresses_increment(self):
        response = self.client.patch(
            f"/api/warbands/{self.warband.id}/henchmen-groups/{self.group.id}/",
            {
                "xp": 5,
                "no_level_ups": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["no_level_ups"])
        self.assertEqual(response.data["level_up"], 0)
        self.group.refresh_from_db()
        self.assertTrue(self.group.no_level_ups)
        self.assertEqual(self.group.level_up, 0)

    def test_henchmen_level_up_endpoint_rejects_no_level_ups_groups(self):
        self.group.level_up = 2
        self.group.no_level_ups = True
        self.group.save(update_fields=["level_up", "no_level_ups"])

        response = self.client.post(
            f"/api/warbands/{self.warband.id}/henchmen-groups/{self.group.id}/level-up/",
            {
                "payload": {
                    "advance": {
                        "id": "WS",
                        "label": "Weapon Skill",
                    }
                }
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "No level ups available")
