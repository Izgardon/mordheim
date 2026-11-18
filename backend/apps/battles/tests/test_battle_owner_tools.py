"""Settings > Active Battles for a battle manager (BATL-NEW-03): each battle's idle time and the tools that apply to
it, `actions`: End a stuck fight with its results (`finish/`), confirm or change a postbattle's results (`results/`),
Close postbattle, and Cancel before postbattle while nobody has applied his postbattle. The manager needn't be in it.

Results already confirmed are the campaign's owner's and admins' to change, here and nowhere else (William,
18 Nov 2026: "lets make it changeable in the battle section of settings for owner and admin, nowhere else")."""

from typing import Any

from apps.campaigns.models import CampaignMembership, CampaignMembershipPermission, CampaignPermission
from apps.warbands.models import Warband

from .battle_support import BattleTestCase, draft

NO_TOOLS = {"end": False, "confirm_results": False, "close_postbattle": False, "cancel": False}


class OwnerToolTests(BattleTestCase):
    def listing(self) -> dict[int, dict[str, Any]]:
        rows = self.ok(self.get_as(self.campaign_owner, f"/api/campaigns/{self.campaign.id}/active-battles/")).data
        return {row["battle"]["id"]: row for row in rows}

    def test_each_battle_says_which_tools_apply_and_how_long_it_has_been_idle(self):
        for user, name in ((self.manager, "Crows"), (self.admin, "Owls"), (self.campaign_owner, "Kites")):
            Warband.objects.create(campaign=self.campaign, user=user, name=name)
        # one battle at a time: a fight clears its players' pre-battles, so others fill those
        inviting = self.create_battle([self.admin], creator=self.manager)
        prebattle = self.create_battle([self.campaign_owner], creator=self.manager)
        self.ok(self.post_as(self.campaign_owner, self.url(prebattle, "join")))
        postbattle, active = self.to_postbattle(), self.to_active()

        listing = self.listing()

        self.assertEqual(listing[inviting]["actions"], {**NO_TOOLS, "cancel": True})
        self.assertEqual(listing[prebattle]["actions"], {**NO_TOOLS, "cancel": True})
        self.assertEqual(listing[active]["actions"], {**NO_TOOLS, "end": True, "cancel": True})
        self.assertEqual(listing[postbattle]["actions"], {**NO_TOOLS, "confirm_results": True, "close_postbattle": True})  # fmt: skip
        self.assertEqual(
            listing[active]["battle"]["last_activity_at"], self.battle(active).last_activity_at.isoformat()
        )

    def test_a_manager_ends_a_stuck_fight_then_closes_its_postbattle(self):
        battle_id = self.to_active()
        self.ok(self.finish_mine(self.player, battle_id, "won"))
        self.ok(self.finalize(self.player, battle_id, draft({})))  # the viewer never finishes
        self.assertEqual(self.listing()[battle_id]["actions"], {**NO_TOOLS, "end": True})  # applied: no cancel

        body = {"winners": [self.warband.id], "losers": [self.rival.id]}
        data = self.ok(self.post_as(self.campaign_owner, self.url(battle_id, "finish"), body)).data

        self.assertEqual((data["battle"]["status"], data["battle"]["results_pending"]), ("postbattle", False))
        self.assertEqual(self.statuses(battle_id), ["confirmed_postbattle", "finished_battle"])
        self.assertEqual(self.listing()[battle_id]["actions"], {**NO_TOOLS, "confirm_results": True, "close_postbattle": True})  # fmt: skip
        self.ok(self.post_as(self.campaign_owner, self.url(battle_id, "close-postbattle")))
        self.assertEqual(self.battle(battle_id).status, "ended")
        self.assertNotIn(battle_id, self.listing())
        self.assertEqual((self.record(self.warband), self.record(self.rival)), ((1, None), (None, 1)))


class ChangeResultsTests(BattleTestCase):
    """Who may change the results of a battle whose results are confirmed: the campaign's owner and admins, from
    Settings > Battles. A player granted manage_battles may confirm pending results but not change confirmed ones,
    and the server says so (William, 18 Nov 2026)."""

    def postbattle_with_results(self) -> int:
        """A battle in postbattle whose results the owner's End already confirmed."""
        battle_id = self.to_postbattle()  # finish/ by the campaign owner: the results come with it
        self.assertFalse(self.battle(battle_id).results_pending)
        return battle_id

    def grant_manage_battles(self, user: Any) -> None:
        membership = CampaignMembership.objects.get(campaign=self.campaign, user=user)
        permission = CampaignPermission.objects.get(code="manage_battles")
        CampaignMembershipPermission.objects.create(membership=membership, permission=permission)

    def results(self, user: Any, battle_id: int, winners: list[int]) -> Any:
        return self.post_as(user, self.url(battle_id, "results"), {"winners": winners})

    def test_a_player_and_a_granted_battle_manager_are_both_refused(self):
        battle_id = self.postbattle_with_results()
        self.grant_manage_battles(self.viewer)

        for user in (self.player, self.viewer):
            with self.subTest(user=user.username):
                answer = self.results(user, battle_id, [self.rival.id])
                self.assertEqual(answer.status_code, 403, answer.data)
                self.assertEqual(answer.data["code"], "change_results_not_allowed")
                self.assertIn("Settings", answer.data["detail"])
        self.assertEqual(self.battle(battle_id).winner_warband_ids_json, [self.warband.id])
        # and neither page offers it: the aftermath's flag is for confirming pending results only
        self.assertFalse(self.capabilities_of(self.viewer, battle_id)["confirm_results"])
        self.assertFalse(self.listing(self.viewer)[battle_id]["actions"]["confirm_results"])

    def test_the_owner_and_an_admin_change_them_from_settings(self):
        battle_id = self.postbattle_with_results()

        self.ok(self.results(self.campaign_owner, battle_id, [self.rival.id]))

        self.assertEqual(self.battle(battle_id).winner_warband_ids_json, [self.rival.id])
        self.assertTrue(self.listing(self.admin)[battle_id]["actions"]["confirm_results"])
        self.ok(self.results(self.admin, battle_id, []))  # no winner
        self.assertEqual(self.battle(battle_id).winner_warband_ids_json, [])

    def capabilities_of(self, user: Any, battle_id: int) -> dict[str, bool]:
        answer = self.ok(self.get_as(user, self.url(battle_id, "state")))
        return dict(answer.data["capabilities"])

    def listing(self, user: Any) -> dict[int, dict[str, Any]]:
        rows = self.ok(self.get_as(user, f"/api/campaigns/{self.campaign.id}/active-battles/")).data
        return {row["battle"]["id"]: row for row in rows}
