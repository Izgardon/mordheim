from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.battles.models import Battle
from apps.campaigns.models import (
    Campaign,
    CampaignMembership,
    CampaignRole,
    CampaignType,
)
from apps.warbands.models import Hero, Warband


class BattleApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_model = get_user_model()
        self.password = "testpass123"

        self.campaign_type = CampaignType.objects.create(code="standard", name="Standard")
        self.owner_role = CampaignRole.objects.create(slug="owner", name="Owner")
        self.player_role = CampaignRole.objects.create(slug="player", name="Player")
        self.admin_role = CampaignRole.objects.create(slug="admin", name="Admin")

        self.owner = self._create_user("owner@example.com", "Owner")
        self.player = self._create_user("player@example.com", "Player")

        self.campaign = Campaign.objects.create(
            campaign_type=self.campaign_type,
            name="Shadows Over Mordheim",
            join_code="ABC123",
        )
        CampaignMembership.objects.create(
            campaign=self.campaign,
            user=self.owner,
            role=self.owner_role,
        )
        CampaignMembership.objects.create(
            campaign=self.campaign,
            user=self.player,
            role=self.player_role,
        )

        self.owner_warband = Warband.objects.create(
            campaign=self.campaign,
            user=self.owner,
            name="Iron Vultures",
            faction="Mercenaries",
        )
        self.player_warband = Warband.objects.create(
            campaign=self.campaign,
            user=self.player,
            name="Night Razors",
            faction="Skaven",
        )

    def _create_user(self, email, name=""):
        return self.user_model.objects.create_user(
            username=email,
            email=email,
            password=self.password,
            first_name=name,
        )

    def _create_battle(self, scenario="Scavenger Hunt"):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/",
            {
                "participant_user_ids": [self.owner.id, self.player.id],
                "scenario": scenario,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        return response.data

    def _ready_both_and_start(self, battle_id):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/join/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/join/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/ready/",
            {"ready": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/ready/",
            {"ready": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/start/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["battle"]["status"], "active")

    def test_create_battle_initial_state(self):
        data = self._create_battle(scenario="Night Raid")

        self.assertEqual(data["battle"]["status"], "inviting")
        self.assertEqual(data["battle"]["scenario"], "Night Raid")
        self.assertEqual(len(data["participants"]), 2)
        participant_statuses = {entry["user"]["id"]: entry["status"] for entry in data["participants"]}
        self.assertEqual(participant_statuses[self.owner.id], "accepted")
        self.assertEqual(participant_statuses[self.player.id], "invited")
        self.assertEqual(len(data["events"]), 1)

    def test_create_battle_requires_scenario(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/",
            {"participant_user_ids": [self.owner.id, self.player.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data.get("detail"), "scenario is required")

    def test_start_requires_all_ready(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/start/",
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data.get("detail"),
            "Waiting for all participants to accept invitation",
        )

    def test_full_battle_flow_declares_winner_and_aggregates_kills(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]
        self._ready_both_and_start(battle_id)

        hero = Hero.objects.create(
            warband=self.owner_warband,
            name="Captain Wolf",
            unit_type="Captain",
        )

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/events/",
            {
                "type": "kill_recorded",
                "payload_json": {
                    "killer_unit_type": "hero",
                    "killer_unit_id": hero.id,
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finish/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finish/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["battle"]["status"], "postbattle")

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/winner/",
            {"winner_warband_id": self.owner_warband.id},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/winner/",
            {"winner_warband_id": self.owner_warband.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["battle"]["winner_warband_id"], self.owner_warband.id)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/confirm/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.data["battle"]["status"], "ended")

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/confirm/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["battle"]["status"], "ended")

        hero.refresh_from_db()
        self.assertEqual(hero.kills, 1)

        battle = Battle.objects.get(id=battle_id)
        self.assertIsNotNone(battle.post_processed_at)

        # Idempotency check: a repeated confirm should not re-apply kills.
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/confirm/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        hero.refresh_from_db()
        self.assertEqual(hero.kills, 1)

    def test_cancel_all_moves_battle_to_canceled(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/cancel/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.data["battle"]["status"], "canceled")

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/cancel/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["battle"]["status"], "canceled")

    def test_creator_can_cancel_battle_while_inviting(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/cancel-battle/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["battle"]["status"], "canceled")
        participant_statuses = {entry["user"]["id"]: entry["status"] for entry in response.data["participants"]}
        self.assertEqual(participant_statuses[self.owner.id], "canceled_prebattle")
        self.assertEqual(participant_statuses[self.player.id], "canceled_prebattle")

    def test_non_creator_cannot_cancel_battle(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/cancel-battle/",
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data.get("detail"), "Only the battle creator can cancel this battle")

    def test_non_creator_cannot_start_battle(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/join/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/ready/",
            {"ready": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/ready/",
            {"ready": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/start/",
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data.get("detail"), "Only the battle creator can start this battle")

    def test_state_since_event_id_returns_incremental_events(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]
        initial_last_event_id = data["events"][-1]["id"]

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/join/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/join/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/ready/",
            {"ready": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/ready/",
            {"ready": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/start/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.get(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/state/?sinceEventId={initial_last_event_id}"
        )
        self.assertEqual(response.status_code, 200)
        event_types = [event["type"] for event in response.data["events"]]
        self.assertIn("battle_started", event_types)

    def test_config_persists_selected_units_and_overrides(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/join/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/join/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": ["hero:1", "henchman:2"],
                "stat_overrides_json": {
                    "hero:1": {
                        "reason": "Scenario wound",
                        "stats": {"weapon_skill": 5, "armour_save": "6+"},
                    }
                },
                "custom_units_json": [
                    {
                        "key": "custom:test-1",
                        "name": "Summoned Wolf",
                        "unit_type": "Beast",
                        "reason": "Scenario summon",
                        "rating": 12,
                        "stats": {
                            "movement": 6,
                            "weapon_skill": 3,
                            "ballistic_skill": 0,
                            "strength": 4,
                            "toughness": 3,
                            "wounds": 1,
                            "initiative": 4,
                            "attacks": 1,
                            "leadership": 5,
                            "armour_save": "-",
                        },
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        owner_participant = next(
            entry
            for entry in response.data["participants"]
            if entry["user"]["id"] == self.owner.id
        )
        self.assertEqual(owner_participant["selected_unit_keys_json"], ["hero:1", "henchman:2"])
        self.assertEqual(owner_participant["stat_overrides_json"]["hero:1"]["reason"], "Scenario wound")
        self.assertEqual(owner_participant["stat_overrides_json"]["hero:1"]["stats"]["armour_save"], "6+")
        self.assertEqual(owner_participant["custom_units_json"][0]["name"], "Summoned Wolf")
        self.assertEqual(owner_participant["custom_units_json"][0]["rating"], 12)

    def test_item_used_allowed_in_prebattle(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/join/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/join/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["battle"]["status"], "prebattle")

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/events/",
            {
                "type": "item_used",
                "payload_json": {
                    "unit_key": "hero:1",
                    "item_id": 100,
                    "item_name": "Healing Herbs",
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["events"][0]["type"], "item_used")
