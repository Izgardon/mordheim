"""Campaign changes reach the other members without a reload (CAMP-NEW-07, IMP-73).

`campaign.updated` goes to `private-campaign-{id}-events` (members only) with the campaign as its detail answers it,
without the reader's own fields; role and grant changes go to that member's own channel as `membership_changed`.
Everything is sent after commit; the writer's socket is skipped. Pusher is replaced by a mock that records triggers.
"""

from typing import Any
from unittest import mock

from django.test import override_settings

from apps.battles.models import Battle
from apps.realtime.channel_auth import authorize_private_channel

from .campaign_support import CampaignTestCase

SOCKET = "123.456"


@override_settings(EXTERNAL_DISPATCH_SYNC=True)
class LiveUpdateTests(CampaignTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.pusher = mock.Mock()
        patcher = mock.patch("apps.realtime.services.get_pusher_client", return_value=self.pusher)
        patcher.start()
        self.addCleanup(patcher.stop)

    def send(self, method: str, user: Any, suffix: str, body: dict[str, Any] | None = None) -> Any:
        self.client.force_authenticate(user=user)
        with self.captureOnCommitCallbacks(execute=True):
            return getattr(self.client, method)(
                self.url(suffix), body or {}, format="json", HTTP_X_PUSHER_SOCKET_ID=SOCKET
            )

    def triggered(self, event: str) -> list[tuple[str, dict, dict]]:
        """(channel, data, keyword arguments) of each trigger of `event`."""
        return [
            (call.args[0], call.args[2], call.kwargs)
            for call in self.pusher.trigger.call_args_list
            if call.args[1] == event
        ]

    def events_channel(self) -> str:
        return f"private-campaign-{self.campaign.id}-events"

    def test_only_members_subscribe_to_the_events_channel(self):
        for user, allowed in ((self.player, True), (self.owner, True), (self.outsider, False)):
            with self.subTest(user=user.first_name):
                self.assertEqual(authorize_private_channel(user, self.events_channel()), allowed)
        self.delete_as(self.owner, self.url(f"members/{self.player.id}/"))
        self.assertFalse(authorize_private_channel(self.player, self.events_channel()))

    def test_a_start_reaches_the_others_without_the_readers_fields(self):
        response = self.send("patch", self.admin, "", {"in_progress": True})

        [(channel, payload, options)] = self.triggered("campaign.updated")
        self.assertEqual((channel, options), (self.events_channel(), {"socket_id": SOCKET}))
        self.assertEqual(payload["in_progress"], True)
        self.assertEqual({"role", "permissions", "capabilities", "chat_unread"} & set(payload), set())
        expected = {key: value for key, value in response.json().items() if key != "role"}
        self.assertEqual(payload, expected)

    def test_settings_the_join_code_archive_and_restore_reach_the_others(self):
        self.send("patch", self.owner, "", {"enable_encampments": True})
        code = self.send("post", self.admin, "join-code/").json()["join_code"]
        self.send("post", self.owner, "archive/")
        self.send("post", self.owner, "restore/")

        payloads = [payload for _channel, payload, _options in self.triggered("campaign.updated")]
        self.assertEqual(len(payloads), 4)
        self.assertEqual(payloads[0]["enable_encampments"], True)
        self.assertEqual(payloads[1]["join_code"], code)
        self.assertEqual((payloads[2]["archived_at"] is not None, payloads[3]["archived_at"]), (True, None))

    def test_refused_writes_send_nothing(self):
        self.send("patch", self.admin, "", {"max_heroes": 5})
        self.send("post", self.player, "join-code/")
        self.assertEqual(self.triggered("campaign.updated"), [])

    def test_role_grant_and_ownership_changes_go_to_the_members_own_channel(self):
        self.send("patch", self.owner, f"members/{self.player.id}/role/", {"role": "admin"})
        self.send("put", self.owner, f"members/{self.rival.id}/permissions/", {"permissions": ["delete_catalogue", "edit_catalogue"]})  # fmt: skip
        self.send("post", self.owner, "ownership/", {"user_id": self.admin.id})

        changes = [(channel, data["payload"]) for channel, data, _options in self.triggered("notification")]
        base = {"campaign_id": self.campaign.id, "campaign_name": "Shards"}
        self.assertEqual(
            changes,
            [
                (f"private-user-{self.player.id}-notifications", {**base, "change": "role", "role": "admin"}),
                (
                    f"private-user-{self.rival.id}-notifications",
                    {**base, "change": "permissions", "permissions": ["edit_catalogue", "delete_catalogue"]},
                ),
                (f"private-user-{self.admin.id}-notifications", {**base, "change": "role", "role": "owner"}),
                (f"private-user-{self.owner.id}-notifications", {**base, "change": "role", "role": "admin"}),
            ],
        )
        self.assertEqual(
            {data["type"] for _channel, data, _options in self.triggered("notification")}, {"membership_changed"}
        )

    def test_deleting_for_good_tells_every_other_member_on_their_own_channel(self):
        # a member on the campaign's pages would otherwise stay there until his next read 404s
        self.send("post", self.owner, "archive/")
        self.pusher.reset_mock()
        self.send("delete", self.owner, "", {"name": "wrong"})
        self.assertEqual(self.triggered("notification"), [])

        self.assertEqual(self.send("delete", self.owner, "", {"name": "Shards"}).status_code, 204)

        deleted = sorted((channel, data) for channel, data, _options in self.triggered("notification"))
        payload = {"campaign_id": self.campaign.id, "campaign_name": "Shards"}
        self.assertEqual(
            deleted,
            sorted(
                (f"private-user-{user.id}-notifications", {"type": "campaign_deleted", "payload": payload})
                for user in (self.admin, self.player, self.rival)
            ),
        )

    def test_a_cancelled_battle_tells_each_player_still_in_it_on_their_own_channel(self):
        # a player away from the battle page kept its Rejoin and its invite until a reload: the cancel went only to
        # the battle's channel
        for actor, suffix in ((self.owner, "active-battles/{}/cancel/"), (self.player, "battles/{}/cancel-battle/")):
            with self.subTest(suffix=suffix):
                self.pusher.reset_mock()
                battle = self.open_battle(Battle.STATUS_INVITING)

                self.assertEqual(self.send("post", actor, suffix.format(battle.id)).status_code, 200)

                payload = {"battle_id": battle.id, "campaign_id": self.campaign.id, "status": "canceled"}
                self.assertEqual(
                    sorted((channel, data) for channel, data, _options in self.triggered("notification")),
                    sorted(
                        (f"private-user-{user.id}-notifications", {"type": "battle_canceled", "payload": payload})
                        for user in (self.player, self.rival)
                    ),
                )
