"""Each auth and feedback throttle at a lowered rate (`rate_limit_support`); the configured rates are in
`test_auth_throttle_characterisation.py`."""

from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.test import override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from apps.users.services.tokens import issue_tokens

from .rate_limit_support import RateLimitTestCase, rest_framework_with_rates


class RateLimitingApiTests(RateLimitTestCase):
    def test_rate_limit_settings_match_expected_defaults(self):
        self.assertTrue(settings.RATE_LIMIT_ENABLED)
        self.assertEqual(
            settings.CACHES["default"]["BACKEND"],
            "django.core.cache.backends.locmem.LocMemCache",
        )
        self.assertEqual(settings.CACHES["default"]["LOCATION"], "rate-limit")
        self.assertEqual(
            settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
            {
                "auth_login_minute": "30/min",
                "auth_login_email_minute": "10/min",
                "auth_login_email_hour": "30/hour",
                "auth_register_hour": "20/hour",
                "auth_register_day": "50/day",
                "auth_password_reset_hour": "20/hour",
                "auth_password_reset_email_hour": "3/hour",
                "auth_password_reset_confirm_hour": "20/hour",
                "auth_refresh_minute": "60/min",
                "auth_account_user": "5/min",
                "feedback_report_user": "3/min",
                "feedback_report_ip": "10/min",
                "campaign_chat_user": "12/min",
                "campaign_chat_ip": "60/min",
                "battle_write_user": "60/min",
                "battle_write_ip": "240/min",
                "trade_write_user": "20/min",
                "trade_write_ip": "60/min",
            },
        )

    @override_settings(REST_FRAMEWORK=rest_framework_with_rates(auth_login_minute="2/min"))
    def test_login_is_rate_limited_by_forwarded_ip_and_returns_retry_after(self):
        self._set_forwarded_ip("198.51.100.10")

        for _ in range(2):
            response = self.client.post("/api/auth/login/", self._login_payload(), format="json")
            self.assertEqual(response.status_code, 400)

        response = self.client.post("/api/auth/login/", self._login_payload(), format="json")
        self.assertEqual(response.status_code, 429)
        self.assertIn("Retry-After", response.headers)

    @override_settings(REST_FRAMEWORK=rest_framework_with_rates(auth_login_minute="1/min"))
    def test_login_rate_limit_does_not_leak_between_ips(self):
        self._set_forwarded_ip("198.51.100.10")
        response = self.client.post("/api/auth/login/", self._login_payload(), format="json")
        self.assertEqual(response.status_code, 400)

        response = self.client.post("/api/auth/login/", self._login_payload(), format="json")
        self.assertEqual(response.status_code, 429)

        self._set_forwarded_ip("198.51.100.11")
        response = self.client.post("/api/auth/login/", self._login_payload(), format="json")
        self.assertEqual(response.status_code, 400)

    @override_settings(REST_FRAMEWORK=rest_framework_with_rates(auth_register_hour="1/hour"))
    def test_register_is_rate_limited_by_ip(self):
        self._set_forwarded_ip("198.51.100.20")

        response = self.client.post(
            "/api/auth/register/",
            {"email": "new-user@example.com", "password": self.password, "name": "New User"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        response = self.client.post(
            "/api/auth/register/",
            {"email": "another-user@example.com", "password": self.password, "name": "Another User"},
            format="json",
        )
        self.assertEqual(response.status_code, 429)

    @patch("apps.users.views.send_password_reset_email", return_value=True)
    @override_settings(
        REST_FRAMEWORK=rest_framework_with_rates(auth_password_reset_hour="1/hour"), RESEND_API_KEY="re_test"
    )
    def test_password_reset_request_is_rate_limited_by_ip(self, _send):
        self._set_forwarded_ip("198.51.100.30")

        response = self.client.post(
            "/api/auth/password-reset/",
            {"email": self.owner.email},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            "/api/auth/password-reset/",
            {"email": self.owner.email},
            format="json",
        )
        self.assertEqual(response.status_code, 429)

    @override_settings(REST_FRAMEWORK=rest_framework_with_rates(auth_password_reset_confirm_hour="1/hour"))
    def test_password_reset_confirm_is_rate_limited_by_ip(self):
        self._set_forwarded_ip("198.51.100.31")
        uid = urlsafe_base64_encode(force_bytes(self.owner.pk))
        token = PasswordResetTokenGenerator().make_token(self.owner)

        response = self.client.post(
            "/api/auth/password-reset-confirm/",
            {"uid": uid, "token": token, "new_password": "newpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            "/api/auth/password-reset-confirm/",
            {"uid": uid, "token": token, "new_password": "newpass456"},
            format="json",
        )
        self.assertEqual(response.status_code, 429)

    @override_settings(REST_FRAMEWORK=rest_framework_with_rates(auth_refresh_minute="2/min"))
    def test_refresh_is_rate_limited_by_ip(self):
        self._set_forwarded_ip("198.51.100.40")
        refresh = issue_tokens(self.owner)["refresh"]  # a pair carrying the session key (SEC-05)

        for _ in range(2):
            response = self.client.post("/api/auth/refresh/", {"refresh": refresh}, format="json")
            self.assertEqual(response.status_code, 200)

        response = self.client.post("/api/auth/refresh/", {"refresh": refresh}, format="json")
        self.assertEqual(response.status_code, 429)

    @patch("apps.users.views.send_feedback_report_email", return_value=True)
    @override_settings(
        REST_FRAMEWORK=rest_framework_with_rates(feedback_report_user="2/min", feedback_report_ip="10/min")
    )
    def test_feedback_report_post_enforces_user_or_ip_limit(self, send_feedback_report_email_mock):
        self._auth_client(self.owner)

        for _ in range(2):
            response = self.client.post(
                "/api/auth/feedback-report/",
                {"report_type": "Bug", "message": "Found a bug in battle setup."},
                format="json",
            )
            self.assertEqual(response.status_code, 200)

        response = self.client.post(
            "/api/auth/feedback-report/",
            {"report_type": "Bug", "message": "Found a bug in battle setup."},
            format="json",
        )
        self.assertEqual(response.status_code, 429)
        self.assertEqual(send_feedback_report_email_mock.call_count, 2)

    @patch("apps.users.views.send_feedback_report_email", return_value=True)
    @override_settings(
        REST_FRAMEWORK=rest_framework_with_rates(feedback_report_user="1/min", feedback_report_ip="10/min")
    )
    def test_feedback_report_limit_does_not_leak_between_users(self, send_feedback_report_email_mock):
        self._auth_client(self.owner)
        owner_response = self.client.post(
            "/api/auth/feedback-report/",
            {"report_type": "Feedback", "message": "Owner report."},
            format="json",
        )
        self.assertEqual(owner_response.status_code, 200)

        self._auth_client(self.player)
        player_response = self.client.post(
            "/api/auth/feedback-report/",
            {"report_type": "Feedback", "message": "Player report."},
            format="json",
        )
        self.assertEqual(player_response.status_code, 200)
        self.assertEqual(send_feedback_report_email_mock.call_count, 2)

    @patch("apps.users.views.send_feedback_report_email", return_value=True)
    @override_settings(
        REST_FRAMEWORK=rest_framework_with_rates(feedback_report_user="10/min", feedback_report_ip="2/min")
    )
    def test_feedback_report_post_enforces_ip_backstop(self, send_feedback_report_email_mock):
        self._auth_client(self.owner)

        for _ in range(2):
            response = self.client.post(
                "/api/auth/feedback-report/",
                {"report_type": "Bug", "message": "Still broken."},
                format="json",
            )
            self.assertEqual(response.status_code, 200)

        response = self.client.post(
            "/api/auth/feedback-report/",
            {"report_type": "Bug", "message": "Still broken."},
            format="json",
        )
        self.assertEqual(response.status_code, 429)
        self.assertEqual(send_feedback_report_email_mock.call_count, 2)
