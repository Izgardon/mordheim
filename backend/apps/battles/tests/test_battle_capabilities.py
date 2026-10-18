"""The state's capabilities: what the reader may do now, by the server's own rules (PR B, BATL-NEW-08 groundwork).

Each flag is checked against the action's endpoint: when it is false the endpoint refuses, when it is true it goes
ahead. Reading them costs no query (the state budget in test_battle_query_budgets.py holds).
"""

from typing import Any

from apps.campaigns.models import CampaignMembership, CampaignMembershipPermission
from apps.campaigns.views import _ensure_permissions
from apps.warbands.models import Warband

from .battle_support import BattleTestCase

NONE = {"start": False, "end": False, "cancel": False, "close_postbattle": False, "edit_record": False}


class BattleCapabilityTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        _ensure_permissions.cache_clear()
        self.addCleanup(_ensure_permissions.cache_clear)

    def capabilities(self, user: Any, battle_id: int) -> dict[str, bool]:
        return dict(self.ok(self.get_as(user, self.url(battle_id, "state"))).data["capabilities"])

    def grant_manage_battles(self, user: Any) -> None:
        membership = CampaignMembership.objects.get(campaign=self.campaign, user=user)
        permission = _ensure_permissions()["manage_battles"]
        CampaignMembershipPermission.objects.create(membership=membership, permission=permission)

    def test_the_creator_cancels_before_the_fight_and_starts_once_everyone_is_ready(self):
        battle_id = self.create_battle()
        self.assertEqual(self.capabilities(self.player, battle_id), {**NONE, "cancel": True})
        self.assertEqual(self.capabilities(self.viewer, battle_id), NONE)

        self.ok(self.post_as(self.viewer, self.url(battle_id, "join")))
        self.ok(self.post_as(self.player, self.url(battle_id, "ready"), {"ready": True}))
        self.assertEqual(self.capabilities(self.player, battle_id), {**NONE, "cancel": True})
        self.assertEqual(self.post_as(self.player, self.url(battle_id, "start")).status_code, 400)

        self.ok(self.post_as(self.viewer, self.url(battle_id, "ready"), {"ready": True}))
        self.assertEqual(self.capabilities(self.player, battle_id), {**NONE, "start": True, "cancel": True})
        self.assertEqual(self.capabilities(self.viewer, battle_id), NONE)
        self.ok(self.post_as(self.player, self.url(battle_id, "start")))

        self.assertEqual(self.capabilities(self.player, battle_id), {**NONE, "end": True, "cancel": True})
        self.assertEqual(self.capabilities(self.viewer, battle_id), NONE)
        self.assertEqual(self.post_as(self.viewer, self.url(battle_id, "finish"), {"winner_warband_ids": []}).status_code, 403)  # fmt: skip

    def test_postbattle_is_closed_by_the_creator_or_a_battle_manager(self):
        battle_id = self.to_postbattle()
        self.assertEqual(self.capabilities(self.player, battle_id), {**NONE, "close_postbattle": True})
        self.assertEqual(self.capabilities(self.viewer, battle_id), NONE)
        self.assertEqual(self.post_as(self.viewer, self.url(battle_id, "close-postbattle")).status_code, 403)

        self.grant_manage_battles(self.viewer)
        self.assertEqual(self.capabilities(self.viewer, battle_id), {**NONE, "close_postbattle": True})
        self.ok(self.post_as(self.viewer, self.url(battle_id, "close-postbattle")))

        self.assertEqual(self.capabilities(self.player, battle_id), NONE)  # ended; the player manages nothing
        self.assertEqual(self.capabilities(self.viewer, battle_id), {**NONE, "edit_record": True})

    def test_owners_and_admins_manage_battles_without_a_grant(self):
        Warband.objects.create(campaign=self.campaign, user=self.admin, name="Crows", faction="Any")
        battle_id = self.to_postbattle({self.player: [], self.admin: []})
        self.assertEqual(self.capabilities(self.admin, battle_id), {**NONE, "close_postbattle": True})
        self.ok(self.post_as(self.admin, self.url(battle_id, "close-postbattle")))
        self.assertEqual(self.capabilities(self.admin, battle_id), {**NONE, "edit_record": True})
