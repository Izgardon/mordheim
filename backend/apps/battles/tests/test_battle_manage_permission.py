"""The `manage_battles` campaign permission (BATL-NEW-04): owners and admins hold it, and it can be granted.

It gates Settings > Active Battles (list and cancel, BATL-NEW-03) and Close postbattle.
"""

from typing import Any

from apps.battles.models import BattleEvent
from apps.campaigns.models import CampaignMembership, CampaignMembershipPermission, CampaignPermission
from apps.campaigns.permissions import get_membership, has_campaign_permission

from .battle_support import BattleTestCase


class ManageBattlesPermissionTests(BattleTestCase):
    def grant(self, user: Any) -> None:
        membership = CampaignMembership.objects.get(campaign=self.campaign, user=user)
        permission = CampaignPermission.objects.get(code="manage_battles")
        CampaignMembershipPermission.objects.create(membership=membership, permission=permission)

    def test_owners_and_admins_hold_it_and_it_can_be_granted(self):
        self.assertTrue(CampaignPermission.objects.filter(code="manage_battles", name="Manage battles").exists())
        holders = [
            has_campaign_permission(get_membership(user, self.campaign.id), "manage_battles")
            for user in (self.campaign_owner, self.admin, self.player)
        ]
        self.assertEqual(holders, [True, True, False])
        self.assertIn("manage_battles", self.ok(self.get_as(self.admin, f"/api/campaigns/{self.campaign.id}/")).data["permissions"])  # fmt: skip
        self.grant(self.player)
        self.assertTrue(has_campaign_permission(get_membership(self.player, self.campaign.id), "manage_battles"))

    def test_it_gates_the_active_battle_tools(self):
        battle_id = self.create_battle()
        listing = f"/api/campaigns/{self.campaign.id}/active-battles/"
        cancel = f"{listing}{battle_id}/cancel/"
        self.assertEqual(self.get_as(self.manager, listing).status_code, 403)
        self.assertEqual(self.post_as(self.manager, cancel).status_code, 403)

        self.assertEqual(
            [entry["battle"]["id"] for entry in self.ok(self.get_as(self.admin, listing)).data], [battle_id]
        )
        self.grant(self.manager)
        self.ok(self.post_as(self.manager, cancel))

        self.assertEqual(self.battle(battle_id).status, "canceled")
        event = BattleEvent.objects.filter(battle_id=battle_id).last()
        assert event is not None
        self.assertEqual(event.payload_json, {"canceled_by_user_id": self.manager.id, "mode": "campaign_manager"})
