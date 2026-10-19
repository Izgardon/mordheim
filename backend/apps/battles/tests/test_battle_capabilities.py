"""The state's capabilities: what the reader may do now, by the server's own rules (PR B, BATL-NEW-08 groundwork).

Each flag is checked against the action's endpoint: when it is false the endpoint refuses, when it is true it goes
ahead. Reading them costs no query (the state budget in test_battle_query_budgets.py holds).
"""

from typing import Any

from apps.campaigns.models import CampaignMembership, CampaignMembershipPermission
from apps.campaigns.views import _ensure_permissions
from apps.warbands.models import Warband

from .battle_support import BattleTestCase

NONE = {
    "start": False,
    "finish_mine": False,
    "confirm_results": False,
    "cancel": False,
    "close_postbattle": False,
    "edit_record": False,
    "nudge": False,
}
OPEN = {**NONE, "nudge": True}  # any player still in an open battle can nudge (BATL-NEW-08)


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

    def test_the_creator_cancels_before_the_fight_and_anyone_starts_once_everyone_is_ready(self):
        battle_id = self.create_battle()
        self.assertEqual(self.capabilities(self.player, battle_id), {**OPEN, "cancel": True})
        self.assertEqual(self.capabilities(self.viewer, battle_id), OPEN)

        self.ok(self.post_as(self.viewer, self.url(battle_id, "join")))
        self.ok(self.post_as(self.player, self.url(battle_id, "ready"), {"ready": True}))
        self.assertEqual(self.capabilities(self.player, battle_id), {**OPEN, "cancel": True})
        self.assertEqual(self.post_as(self.player, self.url(battle_id, "start")).status_code, 400)

        self.ok(self.post_as(self.viewer, self.url(battle_id, "ready"), {"ready": True}))
        self.assertEqual(self.capabilities(self.player, battle_id), {**OPEN, "start": True, "cancel": True})
        self.assertEqual(self.capabilities(self.viewer, battle_id), {**OPEN, "start": True})  # decision 4
        self.ok(self.post_as(self.viewer, self.url(battle_id, "start")))

        # decision 4: each player finishes his own battle; nobody has an End
        self.assertEqual(self.capabilities(self.player, battle_id), {**OPEN, "finish_mine": True, "cancel": True})
        self.assertEqual(self.capabilities(self.viewer, battle_id), {**OPEN, "finish_mine": True})
        self.assertEqual(self.post_as(self.player, self.url(battle_id, "finish"), {"winners": []}).status_code, 403)
        self.ok(self.finish_mine(self.viewer, battle_id, "lost"))
        self.assertEqual(self.capabilities(self.viewer, battle_id), OPEN)

    def test_a_player_who_left_neither_starts_nor_is_offered_it(self):
        # Decision 4: the start is any participant's who is still in the battle
        Warband.objects.create(campaign=self.campaign, user=self.manager, name="Crows", faction="X")
        battle_id = self.to_prebattle([self.viewer, self.manager])
        self.ok(self.post_as(self.manager, self.url(battle_id, "cancel")))
        for user in (self.player, self.viewer):
            self.ok(self.post_as(user, self.url(battle_id, "ready"), {"ready": True}))

        self.assertFalse(self.capabilities(self.manager, battle_id)["start"])
        response = self.post_as(self.manager, self.url(battle_id, "start"))
        expected = {"detail": "You are no longer in this battle", "code": "not_in_battle"}
        self.assertEqual((response.status_code, response.data), (400, expected))
        self.assertTrue(self.capabilities(self.viewer, battle_id)["start"])

    def test_postbattle_is_closed_by_the_creator_or_a_battle_manager(self):
        battle_id = self.to_postbattle()
        self.assertEqual(self.capabilities(self.player, battle_id), {**OPEN, "close_postbattle": True})
        self.assertEqual(self.capabilities(self.viewer, battle_id), OPEN)
        self.assertEqual(self.post_as(self.viewer, self.url(battle_id, "close-postbattle")).status_code, 403)

        self.grant_manage_battles(self.viewer)
        manager = {**OPEN, "close_postbattle": True, "confirm_results": True}
        self.assertEqual(self.capabilities(self.viewer, battle_id), manager)
        self.ok(self.post_as(self.viewer, self.url(battle_id, "close-postbattle")))

        self.assertEqual(self.capabilities(self.player, battle_id), NONE)  # ended; the player manages nothing
        self.assertEqual(self.capabilities(self.viewer, battle_id), {**NONE, "edit_record": True})

    def test_owners_and_admins_manage_battles_without_a_grant(self):
        Warband.objects.create(campaign=self.campaign, user=self.admin, name="Crows", faction="Any")
        battle_id = self.to_postbattle({self.player: [], self.admin: []})
        self.assertEqual(self.capabilities(self.admin, battle_id), {**OPEN, "close_postbattle": True, "confirm_results": True})  # fmt: skip
        self.ok(self.post_as(self.admin, self.url(battle_id, "close-postbattle")))
        self.assertEqual(self.capabilities(self.admin, battle_id), {**NONE, "edit_record": True})

    def test_every_write_answers_the_callers_capabilities_and_broadcasts_everyones(self):
        # A status change costs no read: the answer has the caller's flags, the broadcast every player's and a
        # battle manager's (a manager ORs the two)
        data = self.ok(self.post_as(self.player, self.battles_url(), {"participant_user_ids": [self.viewer.id], "scenario": "Bridge"}), 201).data  # fmt: skip
        battle_id = data["battle"]["id"]
        self.assertEqual(data["capabilities"], self.capabilities(self.player, battle_id))
        steps: list[tuple[Any, Any, str, dict[str, Any]]] = [
            (self.viewer, self.player, "join", {}),
            (self.player, self.viewer, "ready", {"ready": True}),
            (self.viewer, self.player, "ready", {"ready": True}),
            (self.viewer, self.player, "start", {}),
            (self.player, self.viewer, "finish-mine", {"result": "won"}),
            (self.viewer, self.player, "finish-mine", {"result": "lost"}),
            (self.viewer, self.player, "results", {"winners": [self.warband.id]}),
        ]
        for user, other, action, body in steps:
            with self.subTest(action=action, user=user.username):
                data = self.ok(self.post_as(user, self.url(battle_id, action), body)).data
                broadcast = self.battle_events.call_args.kwargs["capabilities"]
                self.assertEqual(data["capabilities"], self.capabilities(user, battle_id))
                self.assertEqual(broadcast["by_user"][str(other.id)], self.capabilities(other, battle_id))

        self.grant_manage_battles(self.viewer)
        as_player, as_manager = broadcast["by_user"][str(self.viewer.id)], broadcast["manager"]
        merged = {flag: as_player[flag] or as_manager[flag] for flag in as_player}
        self.assertEqual(merged, self.capabilities(self.viewer, battle_id))
        self.assertTrue(merged["close_postbattle"])
