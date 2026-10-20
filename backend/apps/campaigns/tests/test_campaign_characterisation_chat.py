"""Campaign chat and the bulletin board (CAMP-TEST-20; decision 8).

Neither has moderation today: chat has no delete at all and a bulletin note can be deleted (for good) only by its
author. The chat send is dispatched after commit; the test runner turns Pusher off, so the helper the view calls is
wrapped (still run) and its calls recorded.
"""

from datetime import timedelta
from typing import Any
from unittest import mock

from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.campaigns.models import CampaignBulletinEntry, CampaignMessage
from apps.realtime import services as realtime

from .campaign_support import CampaignTestCase


class ChatTests(CampaignTestCase):
    def setUp(self) -> None:
        super().setUp()
        patcher = mock.patch(
            "apps.campaigns.services.chat.send_campaign_chat_message", wraps=realtime.send_campaign_chat_message
        )
        self.chat_events = patcher.start()
        self.addCleanup(patcher.stop)

    def say(self, count: int, user: Any = None) -> list[int]:
        """`count` messages written directly, one second apart, oldest first; their ids."""
        user = user or self.player
        start = timezone.now() - timedelta(hours=1)
        ids = []
        for index in range(count):
            message = CampaignMessage.objects.create(
                campaign=self.campaign, user=user, username=user.first_name, body=f"Message {index}"
            )
            CampaignMessage.objects.filter(id=message.id).update(created_at=start + timedelta(seconds=index))
            ids.append(message.id)
        return ids

    def page(self, query: str = "") -> list[int]:
        response = self.get_as(self.rival, self.url(f"messages/{query}"))
        self.assertEqual(response.status_code, 200)
        return [row["id"] for row in response.json()]

    def test_history_comes_in_pages_of_fifty_newest_first(self):
        ids = self.say(55)
        newest_first = ids[::-1]

        first = self.page()
        second = self.page(f"?before={first[-1]}")

        self.assertEqual(first, newest_first[:50])
        self.assertEqual(second, newest_first[50:])
        self.assertEqual(self.page(f"?before={second[-1]}"), [])
        self.assertEqual(self.page("?before=soon"), first)  # a bad cursor is ignored

    def test_pages_are_cut_and_ordered_by_id(self):
        # PERF-45: pages were cut by id but ordered by created_at, which no index served
        older_id, newer_id = self.say(2)
        CampaignMessage.objects.filter(id=newer_id).update(created_at=timezone.now() - timedelta(days=1))

        self.assertEqual(self.page(), [newer_id, older_id])
        self.client.force_authenticate(user=self.rival)
        with CaptureQueriesContext(connection) as captured:
            self.client.get(self.url("messages/"))
        self.assertIn('ORDER BY "campaign_message"."id" DESC', captured[-1]["sql"])

    def test_a_message_is_trimmed_stored_with_the_first_name_and_sent_after_commit(self):
        response = self.post_as(self.player, self.url("messages/"), {"body": "  Ale at the Drunken Goblin  "})

        self.assertEqual(response.status_code, 201)
        data = response.json()
        expected = {"campaign_id": self.campaign.id, "user_id": self.player.id, "username": "Pia"}
        self.assertEqual({key: data[key] for key in expected}, expected)
        self.assertEqual(data["body"], "Ale at the Drunken Goblin")
        self.chat_events.assert_called_once()
        campaign_id, message = self.chat_events.call_args.args
        self.assertEqual((campaign_id, message.id), (self.campaign.id, data["id"]))

    def test_a_message_must_have_text_and_at_most_2000_characters(self):
        for body, detail in (
            ({"body": ""}, "Message body is required."),
            ({"body": "   "}, "Message body is required."),
            ({}, "Message body is required."),
            ({"body": "x" * 2001}, "Message is too long."),
        ):
            with self.subTest(length=len(body.get("body", ""))):
                response = self.post_as(self.player, self.url("messages/"), body)
                self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))
        self.assertEqual(self.post_as(self.player, self.url("messages/"), {"body": "x" * 2000}).status_code, 201)
        self.assertEqual(CampaignMessage.objects.count(), 1)

    def test_a_body_that_is_not_text_is_refused(self):
        # BUG-129: str() of whatever JSON came in used to be stored ({"body": ["hello", 2]} -> "['hello', 2]")
        detail = "Message body must be text."
        for body in (["hello", 2], {"text": "hi"}, 42, True, None):
            with self.subTest(body=body):
                response = self.post_as(self.player, self.url("messages/"), {"body": body})
                self.assertEqual(
                    (response.status_code, response.json()),
                    (400, {"detail": detail, "code": "invalid", "fields": {"body": [detail]}}),
                )
        self.assertFalse(CampaignMessage.objects.exists())

    def test_only_members_read_and_post_and_nobody_deletes(self):
        self.say(1)
        self.assertEqual(self.get_as(self.outsider, self.url("messages/")).status_code, 404)
        self.assertEqual(self.post_as(self.outsider, self.url("messages/"), {"body": "Hi"}).status_code, 404)
        self.assertEqual(CampaignMessage.objects.count(), 1)
        # CAMP-UX-08: no delete, not even for the owner (decision 8 adds "removed by admin" in PR C)
        self.assertEqual(self.delete_as(self.owner, self.url("messages/")).status_code, 405)

    @override_settings(EXTERNAL_DISPATCH_SYNC=True)
    def test_a_pusher_failure_after_commit_still_answers_201(self):
        client = mock.Mock()
        client.trigger.side_effect = RuntimeError("Pusher is down")

        with (
            mock.patch("apps.realtime.services.get_pusher_client", return_value=client),
            self.assertLogs("apps.core.dispatch", level="ERROR"),
            self.captureOnCommitCallbacks(execute=True),
        ):
            response = self.post_as(self.player, self.url("messages/"), {"body": "Still here"})

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            client.trigger.call_args.args[:2], (f"private-campaign-{self.campaign.id}-chat", "chat.message")
        )
        self.assertTrue(CampaignMessage.objects.filter(body="Still here").exists())


class BulletinTests(CampaignTestCase):
    def note(self, user: Any, body: str = "WTB wyrdstone") -> Any:
        response = self.post_as(user, self.url("bulletin/"), {"body": body})
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def test_notes_list_newest_first_with_the_authors_first_name(self):
        first = self.note(self.player, "  Looking for a sling.  ")
        second = self.note(self.rival)

        listed = self.get_as(self.owner, self.url("bulletin/")).data

        self.assertEqual(
            [(row["id"], row["username"]) for row in listed], [(second["id"], "Rex"), (first["id"], "Pia")]
        )
        self.assertEqual(listed[1]["body"], "Looking for a sling.")
        self.assertEqual(len(self.note(self.player, "x" * 280)["body"]), 280)

    def test_only_the_author_deletes_a_note_and_the_delete_is_for_good(self):
        # Characterises current behaviour (CAMP-UX-08, pinned; flips in PR C: decision 8, owner and admins soft-remove)
        note = self.note(self.player)
        url = self.url(f"bulletin/{note['id']}/")
        for user, expected in ((self.owner, 403), (self.admin, 403), (self.rival, 403), (self.outsider, 404)):
            with self.subTest(user=user.first_name):
                self.assertEqual(self.delete_as(user, url).status_code, expected)
        self.assertTrue(CampaignBulletinEntry.objects.filter(id=note["id"]).exists())

        self.assertEqual(self.delete_as(self.player, url).status_code, 204)

        self.assertFalse(CampaignBulletinEntry.objects.filter(id=note["id"]).exists())
        self.assertEqual(self.delete_as(self.player, url).status_code, 404)

    def test_only_members_read_and_post(self):
        self.assertEqual(self.get_as(self.outsider, self.url("bulletin/")).status_code, 404)
        self.assertEqual(self.post_as(self.outsider, self.url("bulletin/"), {"body": "Hi"}).status_code, 404)
        self.assertFalse(CampaignBulletinEntry.objects.exists())
