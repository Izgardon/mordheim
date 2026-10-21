"""The auth throttles (pass 6; BUG-55, SEC-04, AUTH-TEST-17).

Characterisation found every auth throttle keyed on the client address alone, at rates a table of players sharing one
address soon hit. PR A loosened the per-address rates and added per-email limits (`test_auth_email_throttles.py`):
login 30 a minute per address, 10 a minute and 30 an hour per email; register 20 an hour and 50 a day per address;
reset 20 an hour per address and 3 an hour per email; reset confirm 20 an hour; refresh 60 a minute. Each throttle
counts every request that reaches it, refusals included, in the default cache: LocMem, per gunicorn worker, now with
room for 10,000 entries. `RATE_LIMIT_NUM_PROXIES` sets DRF's NUM_PROXIES (`test_settings_characterisation.py`).

These run at the configured rates (`test_rate_limiting.py` checks each throttle at lowered ones) and set
NUM_PROXIES explicitly, since the settings and a local `.env` may set it. Passwords hash with MD5 here, so the
many sign-ups and sign-ins stay quick.
"""

from typing import Any
from unittest import mock

from django.conf import settings
from django.core.cache import caches
from django.test import override_settings
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from apps.core.throttling import AuthLoginMinuteIPRateThrottle, EmailRateThrottle, IPRateThrottle, UserOrIPRateThrottle
from apps.core.views import HealthView, KeepAwakeView
from apps.users import views
from apps.users.tests.auth_support import (
    LOGIN,
    PASSWORD,
    REFRESH,
    REGISTER,
    RESET,
    RESET_CONFIRM,
    AuthTestCase,
    make_user,
)

FAST_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher", "django.contrib.auth.hashers.PBKDF2PasswordHasher"]


def rest_framework(num_proxies: int | None) -> dict[str, Any]:
    """REST_FRAMEWORK as configured, with NUM_PROXIES absent or set."""
    config = {key: value for key, value in settings.REST_FRAMEWORK.items() if key != "NUM_PROXIES"}
    if num_proxies is not None:
        config["NUM_PROXIES"] = num_proxies
    return config


class TableTestCase(AuthTestCase):
    """A table of players: one public address, one X-Forwarded-For value."""

    players: list[Any]

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.players = [make_user(f"player{n}@example.com", f"Player {n}") for n in range(6)]

    def from_table(self, url: str, body: dict[str, Any], address: str = "203.0.113.5") -> Any:
        return self.post(url, body, HTTP_X_FORWARDED_FOR=address)

    def assert_throttled(self, response: Any, window: int) -> None:
        self.assertEqual(response.status_code, 429)
        wait = int(response["Retry-After"])
        self.assertTrue(window - 5 <= wait <= window, wait)
        self.assertEqual(response.json(), {"detail": f"Request was throttled. Expected available in {wait} seconds."})


@override_settings(RATE_LIMIT_ENABLED=True, REST_FRAMEWORK=rest_framework(1), PASSWORD_HASHERS=FAST_HASHERS)
class AuthThrottleRateTests(TableTestCase):
    def test_twenty_sign_ups_an_hour_from_one_address_and_the_twenty_first_is_refused(self):
        # BUG-55 (was pinned: the 4th was refused; flipped in PR A: 20 an hour and 50 a day per address)
        for n in range(20):
            response = self.from_table(REGISTER, {"email": f"new{n}@example.com", "password": PASSWORD, "name": f"New {n}"})  # fmt: skip
            self.assertEqual(response.status_code, 201)

        self.assert_throttled(self.from_table(REGISTER, {"email": "new20@example.com", "password": PASSWORD, "name": "New"}), 3600)  # fmt: skip

    def test_thirty_sign_ins_a_minute_from_one_address_and_the_thirty_first_is_refused(self):
        # BUG-55 (was pinned: the 6th was refused; flipped in PR A: 30 a minute per address, 10 per email)
        for player in self.players * 5:
            self.assertEqual(self.from_table(LOGIN, {"email": player.email, "password": PASSWORD}).status_code, 200)

        self.assert_throttled(self.from_table(LOGIN, {"email": "pia@example.com", "password": PASSWORD}), 60)

    @override_settings(RESEND_API_KEY="re_test")
    @mock.patch("apps.users.views.send_password_reset_email", return_value=True)
    def test_twenty_reset_requests_an_hour_from_one_address_and_the_twenty_first_is_refused(self, _send):
        # BUG-55 (was pinned: the 4th was refused; flipped in PR A: 20 an hour per address, 3 per email)
        for n in range(20):
            self.assertEqual(self.from_table(RESET, {"email": f"someone{n}@example.com"}).status_code, 200)

        self.assert_throttled(self.from_table(RESET, {"email": "someone20@example.com"}), 3600)

    def test_the_twenty_first_reset_confirm_and_the_sixty_first_refresh_are_refused_and_refusals_count(self):
        # BUG-55 (was pinned: the 11th confirm and the 31st refresh; flipped in PR A: 20 an hour and 60 a minute)
        confirm = {"uid": "MQ", "token": "spent", "new_password": "crimson-lantern-42"}
        self.assertEqual({self.from_table(RESET_CONFIRM, confirm).status_code for _ in range(20)}, {400})
        self.assert_throttled(self.from_table(RESET_CONFIRM, confirm), 3600)

        self.assertEqual({self.from_table(REFRESH, {"refresh": "garbage"}).status_code for _ in range(60)}, {401})
        self.assert_throttled(self.from_table(REFRESH, {"refresh": "garbage"}), 60)

    def test_one_email_from_many_addresses_is_refused_after_ten_a_minute(self):
        # SEC-04, BUG-55 (was pinned: never throttled; flipped in PR A: 10 a minute and 30 an hour per email)
        for n in range(10):
            response = self.from_table(LOGIN, {"email": "pia@example.com", "password": "guess"}, f"198.51.100.{n}")
            self.assertEqual(response.status_code, 400)

        self.assert_throttled(self.from_table(LOGIN, {"email": "pia@example.com", "password": "guess"}, "198.51.100.99"), 60)  # fmt: skip

    def test_with_one_proxy_a_rotating_spoofed_prefix_does_not_reset_the_count(self):
        # AUTH-TEST-17: the identity is the address Render's proxy appended (distinct emails, so only the address
        # limit applies)
        attempts = [self.from_table(LOGIN, {"email": f"guess{n}@example.com", "password": "guess"}, f"10.9.8.{n}, 203.0.113.5") for n in range(31)]  # fmt: skip

        self.assertEqual([response.status_code for response in attempts], [400] * 30 + [429])

    @override_settings(RATE_LIMIT_ENABLED=False)
    def test_the_kill_switch_turns_every_auth_throttle_off(self):
        attempts = [self.from_table(LOGIN, {"email": "pia@example.com", "password": "guess"}) for _ in range(12)]

        self.assertEqual({response.status_code for response in attempts}, {400})


@override_settings(RATE_LIMIT_ENABLED=True, REST_FRAMEWORK=rest_framework(None), PASSWORD_HASHERS=FAST_HASHERS)
class UnsetProxyCountTests(TableTestCase):
    def test_a_rotating_forwarded_header_gets_a_fresh_address_bucket_each_time(self):
        # Characterises DRF without NUM_PROXIES (SEC-04): the whole header is the identity, and a client can send any.
        # Production no longer runs this way (RATE_LIMIT_NUM_PROXIES defaults to 1 with DEBUG off), and the email
        # limits hold regardless
        attempts = [self.from_table(LOGIN, {"email": f"guess{n}@example.com", "password": "guess"}, f"10.9.8.{n}, 203.0.113.5") for n in range(31)]  # fmt: skip

        self.assertEqual({response.status_code for response in attempts}, {400})


class ThrottleIdentityTests(AuthTestCase):
    def ident(self, forwarded: str | None = None) -> str | None:
        request = APIRequestFactory().post(LOGIN, REMOTE_ADDR="10.0.0.1")
        if forwarded:
            request.META["HTTP_X_FORWARDED_FOR"] = forwarded
        key: str | None = AuthLoginMinuteIPRateThrottle().get_cache_key(Request(request), None)
        return key

    @override_settings(REST_FRAMEWORK=rest_framework(None))
    def test_without_num_proxies_the_whole_forwarded_header_is_the_identity(self):
        # Characterises DRF without NUM_PROXIES (SEC-04); see UnsetProxyCountTests
        self.assertEqual(self.ident("6.6.6.6, 203.0.113.9"), "throttle_auth_login_minute_6.6.6.6,203.0.113.9")
        self.assertEqual(self.ident(), "throttle_auth_login_minute_10.0.0.1")

    def test_num_proxies_picks_that_many_addresses_from_the_right(self):
        # AUTH-TEST-17; 0 means the socket address, and a short header gives its first address
        cases = {(1, "6.6.6.6, 203.0.113.9"): "203.0.113.9", (2, "6.6.6.6, 203.0.113.9"): "6.6.6.6", (2, "203.0.113.9"): "203.0.113.9", (0, "6.6.6.6"): "10.0.0.1", (1, None): "10.0.0.1"}  # fmt: skip
        for (num_proxies, forwarded), address in cases.items():
            with self.subTest(num_proxies=num_proxies, forwarded=forwarded):
                with override_settings(REST_FRAMEWORK=rest_framework(num_proxies)):
                    self.assertEqual(self.ident(forwarded), f"throttle_auth_login_minute_{address}")


def scopes(view: Any) -> list[tuple[str, str, type]]:
    """Each of the view's throttles as (scope, configured rate, kind)."""
    rates = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
    return [(throttle.scope, rates[throttle.scope], throttle.__base__) for throttle in view.throttle_classes]


class ThrottleConfigurationTests(AuthTestCase):
    def test_the_auth_endpoints_throttle_per_address_and_per_email_at_these_rates(self):
        # BUG-55, SEC-04 (was pinned: per address only, at 5/min to sign in and 3/hour to sign up; flipped in PR A)
        ip, email, user = IPRateThrottle, EmailRateThrottle, UserOrIPRateThrottle
        endpoints: dict[Any, list[tuple[str, str, type]]] = {
            views.LoginView: [
                ("auth_login_minute", "30/min", ip),
                ("auth_login_email_minute", "10/min", email),
                ("auth_login_email_hour", "30/hour", email),
            ],
            views.RegisterView: [("auth_register_hour", "20/hour", ip), ("auth_register_day", "50/day", ip)],
            views.PasswordResetRequestView: [
                ("auth_password_reset_hour", "20/hour", ip),
                ("auth_password_reset_email_hour", "3/hour", email),
            ],
            views.PasswordResetConfirmView: [("auth_password_reset_confirm_hour", "20/hour", ip)],
            views.RefreshView: [("auth_refresh_minute", "60/min", ip)],
            views.PasswordChangeView: [("auth_account_user", "5/min", user)],
            views.SignOutOthersView: [("auth_account_user", "5/min", user)],
            views.FeedbackReportView: [("feedback_report_user", "3/min", user), ("feedback_report_ip", "10/min", ip)],
            views.MeView: [],
            HealthView: [],
            KeepAwakeView: [],
        }
        for view, expected in endpoints.items():
            with self.subTest(view=view.__name__):
                self.assertEqual(scopes(view), expected)

    def test_counters_live_in_a_per_process_locmem_cache_with_room_for_ten_thousand(self):
        # SEC-04 (was pinned: Django's default 300 entries, so many addresses evicted real histories; flipped in
        # PR A); each gunicorn worker still has its own
        self.assertEqual(settings.CACHES["default"], {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "rate-limit", "OPTIONS": {"MAX_ENTRIES": 10_000}})  # fmt: skip
        store: Any = caches["default"]
        self.assertEqual((store._max_entries, store._cull_frequency), (10_000, 3))
