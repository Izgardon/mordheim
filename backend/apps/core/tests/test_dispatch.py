from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient, APITestCase

from apps.campaigns.views import _ensure_permissions, _ensure_roles
from apps.core.dispatch import dispatch_after_commit
from apps.realtime.services import send_battle_event


class DispatchAfterCommitTests(TestCase):
    def test_runs_only_after_commit(self):
        fn = Mock()
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            dispatch_after_commit(fn, 1, key="value")
            fn.assert_not_called()
        self.assertEqual(len(callbacks), 1)
        fn.assert_called_once_with(1, key="value")

    def test_failure_is_logged_not_raised(self):
        failing = Mock(side_effect=RuntimeError("pusher down"))
        with self.assertLogs("apps.core.dispatch", level="ERROR"):
            with self.captureOnCommitCallbacks(execute=True):
                dispatch_after_commit(failing)
        failing.assert_called_once()


class PusherSendTests(TestCase):
    def test_send_returns_false_when_pusher_is_not_configured(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.assertFalse(send_battle_event(1, "unit_kill", {}))

    @patch("apps.realtime.services.get_pusher_client")
    def test_trigger_failure_does_not_propagate(self, get_client):
        client = get_client.return_value
        client.trigger.side_effect = RuntimeError("pusher down")
        with self.assertLogs("apps.core.dispatch", level="ERROR"):
            with self.captureOnCommitCallbacks(execute=True):
                self.assertTrue(send_battle_event(7, "unit_kill", {"kills": 1}))
        client.trigger.assert_called_once_with(
            "private-battle-7", "battle.event", {"type": "unit_kill", "payload": {"kills": 1}}
        )


class RealtimeFailureApiTests(APITestCase):
    """A committed write must succeed even when Pusher fails (BUG-01 / INFRA-BUG-01)."""

    client: APIClient

    def setUp(self):
        cache.clear()
        _ensure_roles.cache_clear()
        _ensure_permissions.cache_clear()
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="owner@example.com", email="owner@example.com", password="testpass123", first_name="Owner"
        )
        self.client.force_authenticate(user=self.user)
        response = self.client.post("/api/campaigns/", {"name": "Shards", "max_players": 4}, format="json")
        self.assertEqual(response.status_code, 201)
        self.campaign_id = response.data["id"]

    @patch("apps.realtime.services.get_pusher_client")
    def test_chat_message_is_saved_when_pusher_fails(self, get_client):
        get_client.return_value.trigger.side_effect = RuntimeError("pusher down")
        with self.assertLogs("apps.core.dispatch", level="ERROR"):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    f"/api/campaigns/{self.campaign_id}/messages/", {"body": "Hello"}, format="json"
                )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["body"], "Hello")
