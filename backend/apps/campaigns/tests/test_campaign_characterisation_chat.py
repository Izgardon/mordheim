"""Campaign chat (CAMP-TEST-20; decision 8).

The message list takes no delete: owners and admins remove one message at a time (`test_campaign_moderation.py`).
The chat send is dispatched after commit; the test runner turns Pusher off, so the helper the view calls is wrapped
(still run) and its calls recorded.
"""

from datetime import timedelta
from typing import Any
from unittest import mock

from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.campaigns.models import CampaignMessage
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
        # the list takes no DELETE; owners and admins remove one message at a time (decision 8, test_campaign_moderation)
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
