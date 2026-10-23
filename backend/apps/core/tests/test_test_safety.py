import logging
import socket

import requests
from django.conf import settings
from django.test import SimpleTestCase
from rest_framework.test import APIClient

from apps.realtime.services import get_pusher_client
from apps.users.emails import send_password_reset_email
from config.test_runner import EXTERNAL_SERVICE_SETTINGS, TEST_SESSION_ENGINE, ExternalNetworkCallError


class NetworkSafetyNetTests(SimpleTestCase):
    """The suite must never reach Resend, Pusher or any other external host."""

    def test_external_service_credentials_are_blank(self):
        for name in EXTERNAL_SERVICE_SETTINGS:
            self.assertEqual(getattr(settings, name), "", name)

    def test_pusher_client_is_disabled(self):
        self.assertIsNone(get_pusher_client())

    def test_password_reset_email_is_skipped(self):
        with self.assertLogs("apps.users.emails", "ERROR"):
            self.assertFalse(send_password_reset_email("someone@example.com", "http://localhost/reset"))

    def test_expected_error_answers_stay_out_of_the_output(self):
        # LOGGING sends django.request's 4xx and 5xx lines to stdout (INFRA-CQ-01); the runner keeps them out
        self.assertEqual(logging.getLogger("django.request").level, logging.CRITICAL)

    def test_outbound_http_is_blocked(self):
        with self.assertRaises(ExternalNetworkCallError):
            # IP literal so the check doesn't depend on DNS being available.
            requests.get("https://93.184.216.34/", timeout=1)

    def test_outbound_socket_is_blocked(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            with self.assertRaises(ExternalNetworkCallError):
                sock.connect(("93.184.216.34", 443))
        finally:
            sock.close()

    def test_the_test_client_logs_out_without_a_sessions_table(self):
        # INFRA-CQ-03: the sessions app isn't installed, and DRF's force_authenticate(user=None) logs out through a
        # session, so the run uses the signed-cookie engine (a SimpleTestCase would refuse a query)
        self.assertEqual(settings.SESSION_ENGINE, TEST_SESSION_ENGINE)
        APIClient().force_authenticate(user=None)
