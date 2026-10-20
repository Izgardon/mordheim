"""Chat remembers what you've read (CAMP-TWEAK-09, IMP-78).

The read mark lives on the membership, so it follows a player between phone and desktop and survives a reload; the
campaign detail counts the messages after it, never your own and never removed ones. It used to live in memory and
count every message that arrived while the window was closed, your own from another device included.
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.campaigns.models import Campaign, CampaignMessage

from .campaign_support import CampaignTestCase


class ChatReadTests(CampaignTestCase):
    def say(self, user: Any) -> CampaignMessage:
        return CampaignMessage.objects.create(campaign=self.campaign, user=user, username=user.first_name, body="Hi")

    def unread(self, user: Any) -> int:
        return int(self.get_as(user, self.url()).json()["chat_unread"])

    def mark(self, user: Any, body: dict[str, Any] | None = None) -> Any:
        return self.post_as(user, self.url("messages/read/"), body)

    def test_unread_counts_messages_after_the_mark_never_your_own_or_removed_ones(self):
        self.say(self.rival)
        self.say(self.player)
        last = self.say(self.rival)

        self.assertEqual((self.unread(self.player), self.unread(self.rival), self.unread(self.owner)), (2, 1, 3))
        CampaignMessage.objects.filter(id=last.id).update(removed_at=timezone.now())
        self.assertEqual(self.unread(self.player), 1)
        self.client.force_authenticate(user=self.player)
        with CaptureQueriesContext(connection) as captured:
            self.client.get(self.url())
        self.assertLessEqual(len(captured), 3)  # counted in the detail's own query

    def test_the_mark_moves_forward_only_and_follows_the_member(self):
        first, second = self.say(self.rival), self.say(self.rival)

        response = self.mark(self.player, {"last_read_id": first.id})

        self.assertEqual(response.json(), {"chat_last_read_id": first.id, "chat_unread": 1})
        self.assertEqual(self.unread(self.player), 1)  # what any of his devices reads
        self.assertEqual(self.mark(self.player).json(), {"chat_last_read_id": second.id, "chat_unread": 0})
        self.assertEqual(self.mark(self.player, {"last_read_id": first.id}).json()["chat_last_read_id"], second.id)
        self.assertEqual(
            self.mark(self.player, {"last_read_id": second.id + 99}).json()["chat_last_read_id"], second.id
        )
        self.say(self.rival)
        self.say(self.player)
        self.assertEqual(self.unread(self.player), 1)
        self.assertEqual(self.membership(self.player).chat_last_read_id, second.id)
        self.assertEqual(self.unread(self.owner), 4)  # everyone has his own mark

    def test_a_bad_mark_is_refused_outsiders_get_404_and_an_archived_campaign_still_takes_it(self):
        detail = "last_read_id must be a message id."
        for value in ("soon", -1, True, 1.5):
            with self.subTest(value=value):
                response = self.mark(self.player, {"last_read_id": value})
                self.assertEqual(
                    (response.status_code, response.json()),
                    (400, {"detail": detail, "code": "invalid", "fields": {"last_read_id": [detail]}}),
                )
        self.assertEqual(self.mark(self.outsider).status_code, 404)
        Campaign.objects.filter(id=self.campaign.id).update(archived_at=timezone.now())
        self.say(self.rival)
        self.assertEqual(self.mark(self.player).json()["chat_unread"], 0)
