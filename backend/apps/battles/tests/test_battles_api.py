from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from apps.battles.models import Battle, BattleParticipant
from apps.items.models import Item
from apps.campaigns.models import (
    Campaign,
    CampaignMembership,
    PivotalMoment,
    CampaignRole,
)
from apps.special.models import Special
from apps.warbands.models import Hero, HeroItem, HeroSpecial, Warband, WarbandLog, WarbandResource


class BattleApiTests(APITestCase):
    client: APIClient

    def setUp(self):
        self.client = APIClient()
        self.user_model = get_user_model()
        self.password = "testpass123"

        self.owner_role = CampaignRole.objects.create(slug="owner", name="Owner")
        self.player_role = CampaignRole.objects.create(slug="player", name="Player")
        self.admin_role = CampaignRole.objects.create(slug="admin", name="Admin")

        self.owner = self._create_user("owner@example.com", "Owner")
        self.player = self._create_user("player@example.com", "Player")
        self.third = self._create_user("third@example.com", "Third")

        self.campaign = Campaign.objects.create(
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
        CampaignMembership.objects.create(
            campaign=self.campaign,
            user=self.third,
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
        self.third_warband = Warband.objects.create(
            campaign=self.campaign,
            user=self.third,
            name="Ash Hounds",
            faction="Witch Hunters",
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

    def _create_reported_result(
        self,
        participant_user_ids,
        winner_warband_ids,
        scenario="Street Brawl",
        battle_date="2026-03-10",
    ):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/report-result/",
            {
                "scenario": scenario,
                "battle_date": battle_date,
                "participant_user_ids": participant_user_ids,
                "winner_warband_ids": winner_warband_ids,
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

    def test_create_battle_rejects_busy_participant(self):
        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/",
            {
                "participant_user_ids": [self.player.id, self.third.id],
                "scenario": "Occupied Streets",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/",
            {
                "participant_user_ids": [self.owner.id, self.player.id],
                "scenario": "Second Clash",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data.get("detail"),
            "One or more participants are already in another battle: Player",
        )

    def test_create_reported_result_initial_state(self):
        data = self._create_reported_result(
            [self.player.id, self.third.id],
            [self.owner_warband.id, self.third_warband.id],
        )

        self.assertEqual(data["battle"]["flow_type"], "reported_result")
        self.assertEqual(data["battle"]["status"], "reported_result_pending")
        self.assertEqual(data["battle"]["scenario"], "Street Brawl")
        self.assertEqual(
            data["battle"]["winner_warband_ids_json"],
            [self.owner_warband.id, self.third_warband.id],
        )
        participant_statuses = {entry["user"]["id"]: entry["status"] for entry in data["participants"]}
        self.assertEqual(participant_statuses[self.owner.id], "reported_result_approved")
        self.assertEqual(participant_statuses[self.player.id], "reported_result_pending")
        self.assertEqual(participant_statuses[self.third.id], "reported_result_pending")

        battle = Battle.objects.get(id=data["battle"]["id"])
        self.assertIsNotNone(battle.ended_at)
        self.assertEqual(timezone.localtime(battle.ended_at).date().isoformat(), "2026-03-10")

    def test_create_reported_result_requires_valid_battle_date(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/report-result/",
            {
                "scenario": "Street Brawl",
                "battle_date": "not-a-date",
                "participant_user_ids": [self.player.id],
                "winner_warband_ids": [self.owner_warband.id],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data.get("detail"), "battle_date must be a valid date")

    def test_approving_reported_result_commits_wins_losses_and_logs(self):
        data = self._create_reported_result(
            [self.player.id],
            [self.owner_warband.id],
        )
        battle_id = data["battle"]["id"]

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/approve-result/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["battle"]["status"], "ended")

        self.owner_warband.refresh_from_db()
        self.player_warband.refresh_from_db()
        self.assertEqual(self.owner_warband.wins, 1)
        self.assertEqual(self.player_warband.losses, 1)

        owner_log = WarbandLog.objects.filter(
            warband=self.owner_warband,
            feature="battle",
            entry_type="complete",
        ).first()
        player_log = WarbandLog.objects.filter(
            warband=self.player_warband,
            feature="battle",
            entry_type="complete",
        ).first()
        self.assertIsNotNone(owner_log)
        self.assertIsNotNone(player_log)
        self.assertEqual(owner_log.payload.get("result"), "won")
        self.assertEqual(owner_log.payload.get("against"), [self.player_warband.name])
        self.assertEqual(player_log.payload.get("result"), "lost")
        self.assertEqual(player_log.payload.get("against"), [self.owner_warband.name])

    def test_declining_reported_result_cancels_without_logs_or_record_changes(self):
        data = self._create_reported_result(
            [self.player.id],
            [self.owner_warband.id],
        )
        battle_id = data["battle"]["id"]

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/decline-result/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["battle"]["status"], "canceled")

        self.owner_warband.refresh_from_db()
        self.player_warband.refresh_from_db()
        self.assertIsNone(self.owner_warband.wins)
        self.assertIsNone(self.player_warband.losses)
        self.assertFalse(
            WarbandLog.objects.filter(
                feature="battle",
                entry_type="complete",
                warband_id__in=[self.owner_warband.id, self.player_warband.id],
            ).exists()
        )

    def test_reported_result_pending_participants_can_still_start_normal_battle(self):
        self._create_reported_result(
            [self.player.id],
            [self.owner_warband.id],
        )

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/",
            {
                "participant_user_ids": [self.owner.id, self.player.id],
                "scenario": "Fresh Clash",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)

    def test_confirmed_postbattle_participant_can_start_new_battle(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]
        self._ready_both_and_start(battle_id)

        owner_hero = Hero.objects.create(
            warband=self.owner_warband,
            name="Captain Wolf",
            unit_type="Captain",
        )
        resource = WarbandResource.objects.create(
            warband=self.owner_warband,
            name="Wyrdstone",
            amount=0,
        )

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": [f"hero:{owner_hero.id}"],
                "unit_information_json": {
                    f"hero:{owner_hero.id}": {
                        "kill_count": 1,
                        "out_of_action": False,
                        "stats_override": {},
                        "stats_reason": "",
                    }
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finish/",
            {"winner_warband_ids": [self.owner_warband.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["battle"]["status"], "postbattle")

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finalize-postbattle/",
            {
                "postbattle_json": {
                    "exploration": {
                        "dice_values": [4],
                        "resource_id": resource.id,
                    },
                    "unit_results": {
                        f"hero:{owner_hero.id}": {
                            "unit_name": owner_hero.name,
                            "unit_kind": "hero",
                            "unit_type": owner_hero.unit_type,
                            "group_name": "",
                            "out_of_action": False,
                            "kill_count": 1,
                            "xp_earned": 2,
                            "dead": False,
                            "special_ids": [],
                            "serious_injury_rolls": [],
                        }
                    },
                }
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        owner_participant = BattleParticipant.objects.get(battle_id=battle_id, user=self.owner)
        self.assertEqual(owner_participant.status, BattleParticipant.STATUS_CONFIRMED_POSTBATTLE)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/",
            {
                "participant_user_ids": [self.owner.id, self.third.id],
                "scenario": "Fresh Battle",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)

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

    def test_creator_can_end_battle_and_finalize_postbattle(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]
        self._ready_both_and_start(battle_id)

        owner_hero = Hero.objects.create(
            warband=self.owner_warband,
            name="Captain Wolf",
            unit_type="Captain",
        )
        player_hero = Hero.objects.create(
            warband=self.player_warband,
            name="Night Claw",
            unit_type="Assassin Adept",
        )
        injury_special = Special.objects.create(
            campaign=self.campaign,
            name="Battle Scar",
            type="Injury",
            description="Postbattle injury",
        )
        resource = WarbandResource.objects.create(
            warband=self.owner_warband,
            name="Shards",
            amount=0,
        )

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": [f"hero:{owner_hero.id}"],
                "unit_information_json": {
                    f"hero:{owner_hero.id}": {
                        "kill_count": 2,
                        "out_of_action": True,
                        "stats_override": {},
                        "stats_reason": "",
                    }
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": [f"hero:{player_hero.id}"],
                "unit_information_json": {
                    f"hero:{player_hero.id}": {
                        "kill_count": 0,
                        "out_of_action": False,
                        "stats_override": {},
                        "stats_reason": "",
                    }
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finish/",
            {"winner_warband_ids": [self.owner_warband.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["battle"]["status"], "postbattle")
        self.assertEqual(response.data["battle"]["winner_warband_ids_json"], [self.owner_warband.id])
        self.owner_warband.refresh_from_db()
        self.player_warband.refresh_from_db()
        self.assertEqual(self.owner_warband.wins, 1)
        self.assertEqual(self.player_warband.losses, 1)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/postbattle/",
            {
                "postbattle_json": {
                    "exploration": {
                        "dice_values": [5],
                        "resource_id": resource.id,
                    },
                    "unit_results": {
                        f"hero:{owner_hero.id}": {
                            "unit_name": owner_hero.name,
                            "unit_kind": "hero",
                            "unit_type": owner_hero.unit_type,
                            "group_name": "",
                            "out_of_action": True,
                            "kill_count": 2,
                            "xp_earned": 4,
                            "dead": True,
                            "special_ids": [injury_special.id],
                            "death_rolls": [
                                {
                                    "roll_type": "d66",
                                    "rolls": [1, 1],
                                    "result_code": "11",
                                    "result_label": "Dead",
                                    "dead_suggestion": True,
                                }
                            ],
                        }
                    },
                }
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        owner_participant = BattleParticipant.objects.get(battle_id=battle_id, user=self.owner)
        self.assertEqual(
            owner_participant.postbattle_json.get("exploration"),
            {"dice_values": [], "resource_id": None},
        )
        self.assertEqual(
            WarbandLog.objects.filter(
                warband=self.owner_warband,
                feature="personnel",
                entry_type="serious_injury",
            ).count(),
            1,
        )

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/postbattle/",
            {
                "postbattle_json": {
                    "exploration": {
                        "dice_values": [5],
                        "resource_id": resource.id,
                    },
                    "unit_results": {
                        f"hero:{owner_hero.id}": {
                            "unit_name": owner_hero.name,
                            "unit_kind": "hero",
                            "unit_type": owner_hero.unit_type,
                            "group_name": "",
                            "out_of_action": True,
                            "kill_count": 2,
                            "xp_earned": 4,
                            "dead": True,
                            "special_ids": [injury_special.id],
                            "serious_injury_rolls": [
                                {
                                    "roll_type": "d66",
                                    "rolls": [1, 1],
                                    "result_code": "11",
                                    "result_label": "Dead",
                                    "dead_suggestion": True,
                                }
                            ],
                        }
                    },
                }
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            WarbandLog.objects.filter(
                warband=self.owner_warband,
                feature="personnel",
                entry_type="serious_injury",
            ).count(),
            1,
        )

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finalize-postbattle/",
            {
                "postbattle_json": {
                    "exploration": {
                        "dice_values": [5],
                        "resource_id": resource.id,
                    },
                    "unit_results": {
                        f"hero:{owner_hero.id}": {
                            "unit_name": owner_hero.name,
                            "unit_kind": "hero",
                            "unit_type": owner_hero.unit_type,
                            "group_name": "",
                            "out_of_action": True,
                            "kill_count": 2,
                            "xp_earned": 4,
                            "dead": True,
                            "special_ids": [injury_special.id],
                            "serious_injury_rolls": [],
                        }
                    },
                }
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["battle"]["status"], "postbattle")

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finalize-postbattle/",
            {
                "postbattle_json": {
                    "exploration": {"dice_values": [], "resource_id": None},
                    "unit_results": {
                        f"hero:{player_hero.id}": {
                            "unit_name": player_hero.name,
                            "unit_kind": "hero",
                            "unit_type": player_hero.unit_type,
                            "group_name": "",
                            "out_of_action": False,
                            "kill_count": 0,
                            "xp_earned": 1,
                            "dead": False,
                            "special_ids": [],
                            "serious_injury_rolls": [],
                        }
                    },
                }
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["battle"]["status"], "ended")

        owner_hero.refresh_from_db()
        self.assertEqual(owner_hero.kills, 2)
        self.assertEqual(float(owner_hero.xp), 4.0)
        self.assertTrue(owner_hero.dead)
        self.assertTrue(HeroSpecial.objects.filter(hero=owner_hero, special=injury_special).exists())

        player_hero.refresh_from_db()
        self.assertEqual(float(player_hero.xp), 1.0)

        resource.refresh_from_db()
        self.assertEqual(resource.amount, 1)
        battle_complete_log = WarbandLog.objects.filter(
            warband=self.owner_warband,
            feature="battle",
            entry_type="complete",
        ).first()
        self.assertIsNotNone(battle_complete_log)
        self.assertEqual(
            battle_complete_log.payload,
            {
                "result": "won",
                "with": [],
                "against": [self.player_warband.name],
            },
        )
        exploration_log = WarbandLog.objects.filter(
            warband=self.owner_warband,
            feature="battle",
            entry_type="exploration",
        ).first()
        self.assertIsNotNone(exploration_log)
        self.assertEqual(exploration_log.payload, {"dice": [5]})
        self.assertFalse(
            WarbandLog.objects.filter(
                warband=self.owner_warband,
                feature="postbattle",
            ).exists()
        )

        battle = Battle.objects.get(id=battle_id)
        self.assertIsNotNone(battle.post_processed_at)
        self.assertEqual(battle.winner_warband_ids_json, [self.owner_warband.id])
        self.owner_warband.refresh_from_db()
        self.player_warband.refresh_from_db()
        self.assertEqual(self.owner_warband.wins, 1)
        self.assertEqual(self.player_warband.losses, 1)

        response = self.client.get(f"/api/warbands/{self.owner_warband.id}/heroes/detail/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/confirm/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        owner_hero.refresh_from_db()
        self.assertEqual(owner_hero.kills, 2)

    def test_unit_kill_records_battle_role_snapshots(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]
        self._ready_both_and_start(battle_id)

        owner_hero = Hero.objects.create(
            warband=self.owner_warband,
            name="Captain Wolf",
            unit_type="Captain",
            is_leader=True,
        )
        player_hero = Hero.objects.create(
            warband=self.player_warband,
            name="Ogre Mage",
            unit_type="Ogre",
            large=True,
            caster="Wizard",
        )

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": [f"hero:{owner_hero.id}"],
                "custom_units_json": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": [f"hero:{player_hero.id}"],
                "custom_units_json": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/unit-kill/",
            {
                "killer_unit_key": f"hero:{owner_hero.id}",
                "victim_unit_key": f"hero:{player_hero.id}",
                "earned_xp": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        payload = response.data["events"][0]["payload_json"]
        self.assertEqual(payload["killer"]["name"], owner_hero.name)
        self.assertTrue(payload["killer"]["is_leader"])
        self.assertFalse(payload["killer"]["is_caster"])
        self.assertEqual(payload["victim"]["name"], player_hero.name)
        self.assertTrue(payload["victim"]["is_caster"])
        self.assertEqual(payload["victim"]["caster_type"], "Wizard")
        self.assertTrue(payload["victim"]["is_large"])

    def test_pivotal_moments_are_written_only_when_battle_ends(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]
        self._ready_both_and_start(battle_id)

        owner_hero = Hero.objects.create(
            warband=self.owner_warband,
            name="Captain Wolf",
            unit_type="Captain",
        )
        player_hero = Hero.objects.create(
            warband=self.player_warband,
            name="Night Claw",
            unit_type="Assassin Adept",
        )

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": [f"hero:{owner_hero.id}"],
                "unit_information_json": {
                    f"hero:{owner_hero.id}": {
                        "kill_count": 2,
                        "out_of_action": False,
                        "stats_override": {},
                        "stats_reason": "",
                    }
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": [f"hero:{player_hero.id}"],
                "unit_information_json": {
                    f"hero:{player_hero.id}": {
                        "kill_count": 0,
                        "out_of_action": True,
                        "stats_override": {},
                        "stats_reason": "",
                    }
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finish/",
            {"winner_warband_ids": [self.owner_warband.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["battle"]["status"], "postbattle")

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finalize-postbattle/",
            {
                "postbattle_json": {
                    "exploration": {"dice_values": [], "resource_id": None},
                    "unit_results": {
                        f"hero:{owner_hero.id}": {
                            "unit_name": owner_hero.name,
                            "unit_kind": "hero",
                            "unit_type": owner_hero.unit_type,
                            "group_name": "",
                            "out_of_action": False,
                            "kill_count": 2,
                            "xp_earned": 2,
                            "dead": False,
                            "special_ids": [],
                            "serious_injury_rolls": [],
                        }
                    },
                }
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["battle"]["status"], "postbattle")
        self.assertFalse(PivotalMoment.objects.filter(battle_id=battle_id).exists())

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finalize-postbattle/",
            {
                "postbattle_json": {
                    "exploration": {"dice_values": [], "resource_id": None},
                    "unit_results": {
                        f"hero:{player_hero.id}": {
                            "unit_name": player_hero.name,
                            "unit_kind": "hero",
                            "unit_type": player_hero.unit_type,
                            "group_name": "",
                            "out_of_action": True,
                            "kill_count": 0,
                            "xp_earned": 1,
                            "dead": False,
                            "special_ids": [],
                            "serious_injury_rolls": [],
                        }
                    },
                }
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["battle"]["status"], "ended")

        self.assertSetEqual(
            set(
                PivotalMoment.objects.filter(battle_id=battle_id).values_list("kind", flat=True)
            ),
            {"carried_the_fight", "untouched_triumph", "wiped_out"},
        )

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finalize-postbattle/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(PivotalMoment.objects.filter(battle_id=battle_id).count(), 3)

    def test_pivotal_moments_include_giant_slayer_when_large_target_is_killed(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]
        self._ready_both_and_start(battle_id)

        owner_hero = Hero.objects.create(
            warband=self.owner_warband,
            name="Captain Wolf",
            unit_type="Captain",
        )
        player_hero = Hero.objects.create(
            warband=self.player_warband,
            name="Ogre Mage",
            unit_type="Ogre",
            large=True,
        )

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": [f"hero:{owner_hero.id}"],
                "custom_units_json": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": [f"hero:{player_hero.id}"],
                "custom_units_json": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/unit-kill/",
            {
                "killer_unit_key": f"hero:{owner_hero.id}",
                "victim_unit_key": f"hero:{player_hero.id}",
                "earned_xp": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finish/",
            {"winner_warband_ids": [self.owner_warband.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finalize-postbattle/",
            {
                "postbattle_json": {
                    "exploration": {"dice_values": [], "resource_id": None},
                    "unit_results": {
                        f"hero:{owner_hero.id}": {
                            "unit_name": owner_hero.name,
                            "unit_kind": "hero",
                            "unit_type": owner_hero.unit_type,
                            "group_name": "",
                            "out_of_action": False,
                            "kill_count": 1,
                            "xp_earned": 2,
                            "dead": False,
                            "special_ids": [],
                            "serious_injury_rolls": [],
                        }
                    },
                }
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finalize-postbattle/",
            {
                "postbattle_json": {
                    "exploration": {"dice_values": [], "resource_id": None},
                    "unit_results": {
                        f"hero:{player_hero.id}": {
                            "unit_name": player_hero.name,
                            "unit_kind": "hero",
                            "unit_type": player_hero.unit_type,
                            "group_name": "",
                            "out_of_action": True,
                            "kill_count": 0,
                            "xp_earned": 1,
                            "dead": False,
                            "special_ids": [],
                            "serious_injury_rolls": [],
                        }
                    },
                }
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        giant_slayer = PivotalMoment.objects.filter(
            battle_id=battle_id,
            kind="giant_slayer",
        ).first()
        self.assertIsNotNone(giant_slayer)
        self.assertEqual(giant_slayer.unit_name, owner_hero.name)
        self.assertIn(player_hero.name, giant_slayer.detail)

    def test_postbattle_leader_death_reassigns_living_leader(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]
        self._ready_both_and_start(battle_id)

        owner_leader = Hero.objects.create(
            warband=self.owner_warband,
            name="Captain Wolf",
            unit_type="Captain",
            is_leader=True,
        )
        owner_backup = Hero.objects.create(
            warband=self.owner_warband,
            name="Youngblood",
            unit_type="Youngblood",
        )
        player_hero = Hero.objects.create(
            warband=self.player_warband,
            name="Night Claw",
            unit_type="Assassin Adept",
            is_leader=True,
        )

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": [
                    f"hero:{owner_leader.id}",
                    f"hero:{owner_backup.id}",
                ],
                "custom_units_json": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": [f"hero:{player_hero.id}"],
                "custom_units_json": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finish/",
            {"winner_warband_ids": [self.player_warband.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finalize-postbattle/",
            {
                "postbattle_json": {
                    "exploration": {"dice_values": [], "resource_id": None},
                    "unit_results": {
                        f"hero:{owner_leader.id}": {
                            "unit_name": owner_leader.name,
                            "unit_kind": "hero",
                            "unit_type": owner_leader.unit_type,
                            "group_name": "",
                            "out_of_action": True,
                            "kill_count": 0,
                            "xp_earned": 1,
                            "dead": True,
                            "special_ids": [],
                            "serious_injury_rolls": [],
                        },
                        f"hero:{owner_backup.id}": {
                            "unit_name": owner_backup.name,
                            "unit_kind": "hero",
                            "unit_type": owner_backup.unit_type,
                            "group_name": "",
                            "out_of_action": False,
                            "kill_count": 0,
                            "xp_earned": 1,
                            "dead": False,
                            "special_ids": [],
                            "serious_injury_rolls": [],
                        },
                    },
                }
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        owner_leader.refresh_from_db()
        owner_backup.refresh_from_db()
        self.assertTrue(owner_leader.dead)
        self.assertFalse(owner_leader.is_leader)
        self.assertTrue(owner_backup.is_leader)

    def test_finalizing_battle_removes_used_single_use_items(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]
        self._ready_both_and_start(battle_id)

        owner_hero = Hero.objects.create(
            warband=self.owner_warband,
            name="Captain Wolf",
            unit_type="Captain",
        )
        player_hero = Hero.objects.create(
            warband=self.player_warband,
            name="Night Claw",
            unit_type="Assassin Adept",
        )
        healing_herbs = Item.objects.create(
            name="Healing Herbs",
            type="Miscellaneous",
            single_use=True,
        )
        sword = Item.objects.create(
            name="Sword",
            type="Weapons",
            single_use=False,
        )
        HeroItem.objects.create(hero=owner_hero, item=healing_herbs)
        HeroItem.objects.create(hero=owner_hero, item=sword)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": [f"hero:{owner_hero.id}"],
                "unit_information_json": {
                    f"hero:{owner_hero.id}": {
                        "kill_count": 0,
                        "out_of_action": False,
                        "stats_override": {},
                        "stats_reason": "",
                    }
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": [f"hero:{player_hero.id}"],
                "unit_information_json": {
                    f"hero:{player_hero.id}": {
                        "kill_count": 0,
                        "out_of_action": False,
                        "stats_override": {},
                        "stats_reason": "",
                    }
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/events/",
            {
                "type": "item_used",
                "payload_json": {
                    "participant_user_id": self.owner.id,
                    "unit_key": f"hero:{owner_hero.id}",
                    "unit_id": owner_hero.id,
                    "unit_type": "hero",
                    "item_id": healing_herbs.id,
                    "item_name": healing_herbs.name,
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finish/",
            {"winner_warband_ids": [self.owner_warband.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finalize-postbattle/",
            {
                "postbattle_json": {
                    "exploration": {"dice_values": [], "resource_id": None},
                    "unit_results": {
                        f"hero:{owner_hero.id}": {
                            "unit_name": owner_hero.name,
                            "unit_kind": "hero",
                            "unit_type": owner_hero.unit_type,
                            "group_name": "",
                            "out_of_action": False,
                            "kill_count": 0,
                            "xp_earned": 1,
                            "dead": False,
                            "special_ids": [],
                            "serious_injury_rolls": [],
                        }
                    },
                }
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finalize-postbattle/",
            {
                "postbattle_json": {
                    "exploration": {"dice_values": [], "resource_id": None},
                    "unit_results": {
                        f"hero:{player_hero.id}": {
                            "unit_name": player_hero.name,
                            "unit_kind": "hero",
                            "unit_type": player_hero.unit_type,
                            "group_name": "",
                            "out_of_action": False,
                            "kill_count": 0,
                            "xp_earned": 1,
                            "dead": False,
                            "special_ids": [],
                            "serious_injury_rolls": [],
                        }
                    },
                }
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.assertFalse(HeroItem.objects.filter(hero=owner_hero, item=healing_herbs).exists())
        self.assertTrue(HeroItem.objects.filter(hero=owner_hero, item=sword).exists())

    def test_non_creator_cannot_end_active_battle(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]
        self._ready_both_and_start(battle_id)

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finish/",
            {"winner_warband_ids": [self.player_warband.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data.get("detail"), "Only the battle creator can end the active battle")

    def test_finish_commits_wins_and_losses_once(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]
        self._ready_both_and_start(battle_id)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finish/",
            {"winner_warband_ids": [self.owner_warband.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.owner_warband.refresh_from_db()
        self.player_warband.refresh_from_db()
        self.assertEqual(self.owner_warband.wins, 1)
        self.assertEqual(self.player_warband.losses, 1)

    def test_confirm_postbattle_skips_applying_postbattle_results(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]
        self._ready_both_and_start(battle_id)

        owner_hero = Hero.objects.create(
            warband=self.owner_warband,
            name="Captain Wolf",
            unit_type="Captain",
        )
        resource = WarbandResource.objects.create(
            warband=self.owner_warband,
            name="Wyrdstone",
            amount=0,
        )

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": [f"hero:{owner_hero.id}"],
                "unit_information_json": {
                    f"hero:{owner_hero.id}": {
                        "kill_count": 1,
                        "out_of_action": True,
                        "stats_override": {},
                        "stats_reason": "",
                    }
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finish/",
            {"winner_warband_ids": [self.owner_warband.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/postbattle/",
            {
                "postbattle_json": {
                    "exploration": {
                        "dice_values": [6, 6],
                        "resource_id": resource.id,
                    },
                    "unit_results": {
                        f"hero:{owner_hero.id}": {
                            "unit_name": owner_hero.name,
                            "unit_kind": "hero",
                            "unit_type": owner_hero.unit_type,
                            "group_name": "",
                            "out_of_action": True,
                            "kill_count": 1,
                            "xp_earned": 5,
                            "dead": True,
                            "special_ids": [],
                            "serious_injury_rolls": [],
                        }
                    },
                }
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/confirm/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["battle"]["status"], "postbattle")

        owner_hero.refresh_from_db()
        self.assertEqual(owner_hero.kills, 0)
        self.assertEqual(float(owner_hero.xp), 0.0)
        self.assertFalse(owner_hero.dead)

        resource.refresh_from_db()
        self.assertEqual(resource.amount, 0)

        owner_participant = BattleParticipant.objects.get(battle_id=battle_id, user=self.owner)
        self.assertEqual(owner_participant.status, BattleParticipant.STATUS_CONFIRMED_POSTBATTLE)
        self.assertEqual(
            owner_participant.postbattle_json,
            {
                "exploration": {
                    "dice_values": [],
                    "resource_id": None,
                },
                "unit_results": {},
            },
        )
        self.assertFalse(
            WarbandLog.objects.filter(
                warband=self.owner_warband,
                feature="battle",
                entry_type__in=("complete", "exploration"),
            ).exists()
        )

    def test_finalize_postbattle_rejects_more_than_ten_exploration_dice(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]
        self._ready_both_and_start(battle_id)

        owner_hero = Hero.objects.create(
            warband=self.owner_warband,
            name="Captain Wolf",
            unit_type="Captain",
        )

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": [f"hero:{owner_hero.id}"],
                "unit_information_json": {
                    f"hero:{owner_hero.id}": {
                        "kill_count": 0,
                        "out_of_action": False,
                        "stats_override": {},
                        "stats_reason": "",
                    }
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finish/",
            {"winner_warband_ids": [self.owner_warband.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finalize-postbattle/",
            {
                "postbattle_json": {
                    "exploration": {
                        "dice_values": [1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5],
                        "resource_id": None,
                    },
                    "unit_results": {
                        f"hero:{owner_hero.id}": {
                            "unit_name": owner_hero.name,
                            "unit_kind": "hero",
                            "unit_type": owner_hero.unit_type,
                            "group_name": "",
                            "out_of_action": False,
                            "kill_count": 0,
                            "xp_earned": 1,
                            "dead": False,
                            "special_ids": [],
                            "serious_injury_rolls": [],
                        }
                    },
                }
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data.get("detail"),
            "postbattle exploration dice_values must contain at most 10 entries",
        )

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/finish/",
            {"winner_warband_ids": [self.player_warband.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.owner_warband.refresh_from_db()
        self.player_warband.refresh_from_db()
        self.assertEqual(self.owner_warband.wins, 1)
        self.assertEqual(self.player_warband.losses, 1)

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

    def test_creator_can_cancel_battle_while_active(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]
        self._ready_both_and_start(battle_id)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/cancel-battle/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["battle"]["status"], "canceled")

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
                "unit_information_json": {
                    "hero:1": {
                        "stats_override": {"weapon_skill": 5, "armour_save": "6+"},
                        "stats_reason": "Scenario wound",
                        "out_of_action": False,
                        "kill_count": 0,
                    },
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
            entry for entry in response.data["participants"] if entry["user"]["id"] == self.owner.id
        )
        self.assertEqual(owner_participant["selected_unit_keys_json"], ["hero:1", "henchman:2"])
        self.assertEqual(
            owner_participant["unit_information_json"]["hero:1"]["stats_reason"],
            "Scenario wound",
        )
        self.assertEqual(
            owner_participant["unit_information_json"]["hero:1"]["stats_override"]["armour_save"],
            "6+",
        )
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

    def test_unit_ooa_and_kill_endpoints_update_unit_information(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]
        self._ready_both_and_start(battle_id)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": ["hero:11"],
                "custom_units_json": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": ["hero:22"],
                "custom_units_json": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/unit-ooa/",
            {"unit_key": "hero:11", "out_of_action": True},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["events"][0]["type"], "unit_ooa_set")
        owner_participant = next(
            entry for entry in response.data["participants"] if entry["user"]["id"] == self.owner.id
        )
        self.assertTrue(owner_participant["unit_information_json"]["hero:11"]["out_of_action"])

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/unit-kill/",
            {
                "killer_unit_key": "hero:11",
                "victim_unit_key": "hero:22",
                "earned_xp": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "Cannot record kills for a unit that is out of action")

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/unit-ooa/",
            {"unit_key": "hero:11", "out_of_action": False},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["events"][0]["type"], "unit_ooa_unset")

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/unit-kill/",
            {
                "killer_unit_key": "hero:11",
                "victim_unit_key": "hero:22",
                "earned_xp": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["events"][0]["type"], "unit_kill_recorded")
        owner_participant = next(
            entry for entry in response.data["participants"] if entry["user"]["id"] == self.owner.id
        )
        self.assertEqual(owner_participant["unit_information_json"]["hero:11"]["kill_count"], 1)

    def test_unit_kill_allows_custom_victim_name(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]
        self._ready_both_and_start(battle_id)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": ["hero:11"],
                "custom_units_json": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/unit-kill/",
            {
                "killer_unit_key": "hero:11",
                "victim_name": "Ghoul",
                "notes": "Knocked from a rooftop.",
                "earned_xp": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["events"][0]["type"], "unit_kill_recorded")
        self.assertEqual(response.data["events"][0]["payload_json"]["victim"]["name"], "Ghoul")
        self.assertEqual(
            response.data["events"][0]["payload_json"]["notes"],
            "Knocked from a rooftop.",
        )

        owner_participant = next(
            entry for entry in response.data["participants"] if entry["user"]["id"] == self.owner.id
        )
        self.assertEqual(owner_participant["unit_information_json"]["hero:11"]["kill_count"], 1)

    def test_unit_kill_requires_victim_unit_key_or_name(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]
        self._ready_both_and_start(battle_id)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": ["hero:11"],
                "custom_units_json": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/unit-kill/",
            {
                "killer_unit_key": "hero:11",
                "earned_xp": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data["detail"],
            "Either victim_unit_key or victim_name is required",
        )

    def test_active_config_stat_updates_preserve_live_unit_state(self):
        data = self._create_battle()
        battle_id = data["battle"]["id"]
        self._ready_both_and_start(battle_id)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": ["hero:11"],
                "custom_units_json": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/unit-kill/",
            {
                "killer_unit_key": "hero:11",
                "victim_name": "Ghoul",
                "earned_xp": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/unit-ooa/",
            {"unit_key": "hero:11", "out_of_action": True},
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": ["hero:11"],
                "unit_information_json": {
                    "hero:11": {
                        "stats_override": {
                            "wounds": 2,
                            "strength": 4,
                        },
                        "stats_reason": "Battle damage",
                        "out_of_action": True,
                        "kill_count": 1,
                    }
                },
                "custom_units_json": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        owner_participant = next(
            entry for entry in response.data["participants"] if entry["user"]["id"] == self.owner.id
        )
        self.assertTrue(owner_participant["unit_information_json"]["hero:11"]["out_of_action"])
        self.assertEqual(owner_participant["unit_information_json"]["hero:11"]["kill_count"], 1)
        self.assertEqual(owner_participant["unit_information_json"]["hero:11"]["stats_reason"], "Battle damage")
        self.assertEqual(owner_participant["unit_information_json"]["hero:11"]["stats_override"]["wounds"], 2)
        self.assertEqual(owner_participant["unit_information_json"]["hero:11"]["stats_override"]["strength"], 4)

    def test_selected_unit_keys_persist_into_active_state(self):
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
                "selected_unit_keys_json": ["hero:1"],
                "custom_units_json": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{battle_id}/config/",
            {
                "selected_unit_keys_json": ["hero:2"],
                "custom_units_json": [],
            },
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

        owner_participant = next(
            entry for entry in response.data["participants"] if entry["user"]["id"] == self.owner.id
        )
        player_participant = next(
            entry for entry in response.data["participants"] if entry["user"]["id"] == self.player.id
        )
        self.assertEqual(owner_participant["selected_unit_keys_json"], ["hero:1"])
        self.assertEqual(player_participant["selected_unit_keys_json"], ["hero:2"])
