"""Handing ownership to an admin and leaving (decision 4, CAMP-NEW-02, CAMP-NEW-03, CAMP-TEST-13)."""

from typing import Any
from unittest import mock

from apps.battles.models import Battle, BattleEvent
from apps.notifications.models import Notification
from apps.trades.models import TradeRequest
from apps.warbands.models import Warband

from .campaign_support import CampaignTestCase


class HandOverTests(CampaignTestCase):
    def hand_over(self, actor: Any, target: Any) -> Any:
        return self.post_as(actor, self.url("ownership/"), {"user_id": target.id})

    def roles(self) -> list[str]:
        return [self.membership(user).role.slug for user in (self.owner, self.admin, self.player)]

    def test_the_owner_hands_ownership_to_an_admin_and_becomes_an_admin(self):
        response = self.hand_over(self.owner, self.admin)

        self.assertEqual(
            (response.status_code, response.json()),
            (200, {"owner_id": self.admin.id, "previous_owner_id": self.owner.id}),
        )
        self.assertEqual(self.roles(), ["admin", "owner", "player"])
        self.assertEqual(self.patch_as(self.admin, self.url(), {"max_heroes": 5}).status_code, 200)
        self.assertEqual(self.patch_as(self.owner, self.url(), {"max_heroes": 4}).status_code, 403)
        old, new = (self.get_as(user, self.url()).json()["capabilities"] for user in (self.owner, self.admin))
        self.assertEqual((old["hand_over"], old["edit_settings"], old["start"]), (False, False, True))
        self.assertEqual((new["hand_over"], new["edit_settings"]), (True, True))

    def test_only_the_owner_hands_over_and_only_to_an_admin(self):
        not_admin = "Ownership can only go to an admin. Make them an admin first."
        for actor, target, status, code in (
            (self.owner, self.player, 400, "not_an_admin"),
            (self.owner, self.owner, 400, "not_an_admin"),
            (self.owner, self.outsider, 404, "not_found"),
        ):
            with self.subTest(target=target.first_name):
                response = self.hand_over(actor, target)
                self.assertEqual((response.status_code, response.json()["code"]), (status, code))
        self.assertEqual(self.hand_over(self.owner, self.player).json()["fields"], {"user_id": [not_admin]})
        for actor, status in ((self.admin, 403), (self.player, 403), (self.outsider, 404)):
            with self.subTest(actor=actor.first_name):
                self.assertEqual(self.hand_over(actor, self.admin).status_code, status)
        self.assertEqual(self.post_as(self.owner, self.url("ownership/"), {}).status_code, 400)

        self.assertEqual(self.roles(), ["owner", "admin", "player"])

    def test_a_second_hand_over_by_the_old_owner_is_refused(self):
        self.patch_as(self.owner, self.url(f"members/{self.player.id}/role/"), {"role": "admin"})
        self.assertEqual(self.hand_over(self.owner, self.admin).status_code, 200)

        self.assertEqual(self.hand_over(self.owner, self.player).status_code, 403)  # an admin now

        self.assertEqual(self.roles(), ["admin", "owner", "admin"])


class LeaveTests(CampaignTestCase):
    """Leaving (decision 4, CAMP-NEW-03): removal's clean-up, the owner hands over first or, alone, archives."""

    def setUp(self) -> None:
        super().setUp()
        patcher = mock.patch("apps.campaigns.services.leaving.send_user_notification")
        self.user_events = patcher.start()
        self.addCleanup(patcher.stop)

    def leave(self, user: Any, campaign: Any = None) -> Any:
        with self.captureOnCommitCallbacks(execute=True):
            return self.post_as(user, self.url("leave/", campaign))

    def test_a_player_leaves_and_what_he_was_part_of_closes(self):
        battle = self.open_battle(Battle.STATUS_INVITING)
        sent = self.post_as(self.rival, self.url("trade-requests/"), {"target_user_id": self.player.id})
        self.notify(self.player, Notification.TYPE_BATTLE_INVITE, battle.id)

        preview = self.get_as(self.player, self.url("leave/")).json()

        self.assertEqual(preview["member"], {"id": self.player.id, "name": "Pia", "role": "player"})
        self.assertEqual(preview["warband"], {"id": self.warband.id, "name": "Monks"})
        self.assertEqual([(row["id"], row["outcome"]) for row in preview["battles"]], [(battle.id, "cancelled")])
        self.assertEqual([row["id"] for row in preview["trades"]], [sent.json()["id"]])
        self.assertEqual((preview["notifications"], preview["archives_campaign"]), (2, False))

        response = self.leave(self.player)

        self.assertEqual((response.status_code, response.json()), (200, {"outcome": "left"}))
        self.assertFalse(self.is_member(self.player))
        self.assertEqual(Battle.objects.get(id=battle.id).status, Battle.STATUS_CANCELED)
        cancel = BattleEvent.objects.get(battle=battle, type=BattleEvent.TYPE_BATTLE_CANCELED)
        self.assertEqual(cancel.payload_json, {"canceled_by_user_id": self.player.id, "mode": "member_left"})
        self.assertEqual(TradeRequest.objects.get(id=sent.json()["id"]).status, TradeRequest.STATUS_DECLINED)
        self.assertEqual(self.listed_notifications(self.player), [])
        self.assertTrue(Warband.objects.filter(id=self.warband.id).exists())
        self.user_events.assert_called_once_with(
            self.player.id, "membership_left", {"campaign_id": self.campaign.id, "campaign_name": "Shards"}
        )
        self.assertEqual(self.get_as(self.player, self.url()).status_code, 404)

    def test_an_admin_leaves_too(self):
        self.assertEqual(self.leave(self.admin).json(), {"outcome": "left"})
        self.assertFalse(self.is_member(self.admin))

    def test_the_owner_hands_over_first(self):
        body = {"detail": "Hand ownership to an admin before you leave.", "code": "hand_over_first", "fields": {}}
        for response in (self.get_as(self.owner, self.url("leave/")), self.leave(self.owner)):
            self.assertEqual((response.status_code, response.json()), (400, body))
        self.assertEqual(self.membership(self.owner).role.slug, "owner")
        self.assertEqual(self.leave(self.outsider).status_code, 404)

    def test_an_owner_alone_archives_the_campaign_instead(self):
        preview = self.get_as(self.outsider, self.url("leave/", self.elsewhere)).json()
        self.assertTrue(preview["archives_campaign"])

        response = self.leave(self.outsider, self.elsewhere)

        self.assertEqual(response.json(), {"outcome": "archived"})
        self.elsewhere.refresh_from_db()
        self.assertIsNotNone(self.elsewhere.archived_at)
        self.assertEqual(self.membership(self.outsider, self.elsewhere).role.slug, "owner")
        self.user_events.assert_not_called()
