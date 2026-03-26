from django.contrib.auth import get_user_model
from datetime import datetime, timezone as dt_timezone
from rest_framework.test import APIClient, APITestCase

from apps.battles.models import Battle, BattleParticipant
from apps.campaigns.models import CampaignMembership, CampaignRole, PivotalMoment
from apps.campaigns.views import _ensure_permissions, _ensure_roles
from apps.warbands.models import Warband


class CampaignApiTests(APITestCase):
    client: APIClient

    def setUp(self):
        self.client = APIClient()
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

    def test_create_campaign_creates_owner_membership(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)

        membership = CampaignMembership.objects.get(campaign_id=campaign["id"], user=owner)
        self.assertEqual(membership.role.slug, "owner")
        self.assertEqual(len(campaign["join_code"]), 6)

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

        self.client.force_authenticate(user=owner)
        response = self.client.get(f"/api/campaigns/{campaign['id']}/pivotal-moments/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], moment.id)
        self.assertEqual(response.data[0]["headline"], "Giant Slayer")
        self.assertEqual(response.data[0]["warband_name"], owner_warband.name)
        self.assertEqual(response.data[0]["battle_scenario"], battle_with_row.scenario)
        self.assertEqual(response.data[0]["date"], "24/03/26")

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
