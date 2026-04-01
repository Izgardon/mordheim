from django.contrib.auth import get_user_model
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
