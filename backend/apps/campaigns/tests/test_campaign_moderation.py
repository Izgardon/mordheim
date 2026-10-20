"""Owners and admins remove chat and bulletin posts (decision 8, CAMP-NEW-06, CAMP-UX-08).

A soft delete: the post stays listed, without its body, as "removed by admin" (or by its author, for a bulletin
note its author removed), and a removed chat message reaches every member live through `chat.removed`.
"""

from typing import Any
from unittest import mock

from django.test import override_settings

from apps.campaigns.models import CampaignBulletinEntry, CampaignMessage
from apps.realtime import services as realtime

from .campaign_support import CampaignTestCase


class ChatRemovalTests(CampaignTestCase):
    def setUp(self) -> None:
        super().setUp()
        patcher = mock.patch(
            "apps.campaigns.services.chat.send_campaign_chat_removed", wraps=realtime.send_campaign_chat_removed
        )
        self.removed_events = patcher.start()
        self.addCleanup(patcher.stop)

    def remove(self, user: Any, message_id: int) -> Any:
        return self.delete_as(user, self.url(f"messages/{message_id}/"))

    def test_owners_and_admins_remove_a_message_for_everyone(self):
        message = self.post_as(self.player, self.url("messages/"), {"body": "Rude words"}).json()
        for user, status in ((self.player, 403), (self.rival, 403), (self.outsider, 404)):
            with self.subTest(user=user.first_name):
                self.assertEqual(self.remove(user, message["id"]).status_code, status)
        self.removed_events.assert_not_called()

        self.assertEqual(self.remove(self.admin, message["id"]).status_code, 204)

        listed = self.get_as(self.rival, self.url("messages/")).json()
        self.assertEqual(len(listed), 1)
        row = listed[0]
        self.assertEqual((row["id"], row["body"], row["removed_by"]), (message["id"], "", "admin"))
        self.assertEqual((row["username"], row["user_id"]), ("Pia", self.player.id))
        self.assertIsNotNone(row["removed_at"])
        stored = CampaignMessage.objects.get(id=message["id"])
        self.assertEqual((stored.body, stored.removed_by_id), ("Rude words", self.admin.id))  # kept, not shown
        self.removed_events.assert_called_once()
        self.assertEqual(self.removed_events.call_args.args[:2], (self.campaign.id, message["id"]))

        self.assertEqual(self.remove(self.owner, message["id"]).status_code, 204)  # again: nothing changes
        self.removed_events.assert_called_once()
        self.assertEqual(CampaignMessage.objects.get(id=message["id"]).removed_by_id, self.admin.id)

    def test_a_missing_or_foreign_message_is_404(self):
        foreign = CampaignMessage.objects.create(campaign=self.elsewhere, user=self.outsider, username="Otto", body="x")
        self.assertEqual(self.remove(self.owner, foreign.id).status_code, 404)
        self.assertEqual(self.remove(self.owner, foreign.id + 1000).status_code, 404)
        self.assertIsNone(CampaignMessage.objects.get(id=foreign.id).removed_at)

    @override_settings(EXTERNAL_DISPATCH_SYNC=True)
    def test_the_removed_event_names_the_message(self):
        message = CampaignMessage.objects.create(campaign=self.campaign, user=self.player, username="Pia", body="x")
        client = mock.Mock()
        with (
            mock.patch("apps.realtime.services.get_pusher_client", return_value=client),
            self.captureOnCommitCallbacks(execute=True),
        ):
            self.remove(self.owner, message.id)

        channel, event, payload = client.trigger.call_args.args
        self.assertEqual((channel, event), (f"private-campaign-{self.campaign.id}-chat", "chat.removed"))
        self.assertEqual(
            {key: payload[key] for key in ("id", "campaign_id", "removed_by")},
            {"id": message.id, "campaign_id": self.campaign.id, "removed_by": "admin"},
        )


class BulletinRemovalTests(CampaignTestCase):
    def test_owners_and_admins_remove_any_note_and_it_reads_removed_by_admin(self):
        note = CampaignBulletinEntry.objects.create(campaign=self.campaign, user=self.player, username="Pia", body="x")

        self.assertEqual(self.delete_as(self.owner, self.url(f"bulletin/{note.id}/")).status_code, 204)

        row = self.get_as(self.rival, self.url("bulletin/")).json()[0]
        self.assertEqual((row["id"], row["body"], row["removed_by"]), (note.id, "", "admin"))
        self.assertEqual(CampaignBulletinEntry.objects.get(id=note.id).removed_by_id, self.owner.id)
