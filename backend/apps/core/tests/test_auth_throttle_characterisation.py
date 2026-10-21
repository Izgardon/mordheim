"""The auth throttles today (pass 6; BUG-55, SEC-04, AUTH-TEST-17).

Every auth throttle is keyed on the client address alone (`IPRateThrottle`, DRF's `get_ident`), counts each request
that reaches it, refusals included, and keeps its counters in the default cache: LocMem, per gunicorn worker, at
Django's default 300 entries. `RATE_LIMIT_NUM_PROXIES` sets DRF's NUM_PROXIES only when present; production leaves
it unset, so the identity is the whole X-Forwarded-For header. PR A adds per-email limits beside looser per-IP
rates, raises MAX_ENTRIES to 10,000 and refuses to start without RATE_LIMIT_NUM_PROXIES.

These run at the configured rates (`test_rate_limiting.py` checks each throttle at lowered ones) and set
NUM_PROXIES explicitly, since a local `.env` may set it.
"""

from typing import Any
from unittest import mock

from django.conf import settings
from django.core.cache import caches
from django.test import override_settings
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from apps.core.throttling import AuthLoginMinuteIPRateThrottle, IPRateThrottle, UserOrIPRateThrottle
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


def rest_framework(num_proxies: int | None) -> dict[str, Any]:
    """REST_FRAMEWORK as configured, with NUM_PROXIES absent (production today) or set."""
    config = {key: value for key, value in settings.REST_FRAMEWORK.items() if key != "NUM_PROXIES"}
    if num_proxies is not None:
        config["NUM_PROXIES"] = num_proxies
    return config


@override_settings(RATE_LIMIT_ENABLED=True, REST_FRAMEWORK=rest_framework(None))
class AuthThrottleRateTests(AuthTestCase):
    """Six players at one table: one public address, one X-Forwarded-For value."""

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

    def test_the_fourth_sign_up_in_an_hour_from_one_address_is_refused(self):
        # Characterises current behaviour (BUG-55, pinned; flips in PR A: 20 an hour and 50 a day per IP)
        for n in range(3):
            self.assertEqual(self.from_table(REGISTER, {"email": f"new{n}@example.com", "password": PASSWORD}).status_code, 201)  # fmt: skip

        self.assert_throttled(self.from_table(REGISTER, {"email": "new3@example.com", "password": PASSWORD}), 3600)

    def test_the_sixth_sign_in_in_a_minute_from_one_address_is_refused(self):
        # Characterises current behaviour (BUG-55, pinned; flips in PR A: 30 a minute per IP, 10 per email)
        for player in self.players[:5]:
            self.assertEqual(self.from_table(LOGIN, {"email": player.email, "password": PASSWORD}).status_code, 200)

        self.assert_throttled(self.from_table(LOGIN, {"email": self.players[5].email, "password": PASSWORD}), 60)

    @mock.patch("apps.users.views.send_password_reset_email", return_value=True)
    def test_the_fourth_reset_request_in_an_hour_from_one_address_is_refused(self, _send):
        # Characterises current behaviour (BUG-55, pinned; flips in PR A: 20 an hour per IP, 3 per email)
        for player in self.players[:3]:
            self.assertEqual(self.from_table(RESET, {"email": player.email}).status_code, 200)

        self.assert_throttled(self.from_table(RESET, {"email": self.players[3].email}), 3600)

    def test_the_eleventh_reset_confirm_and_the_thirty_first_refresh_are_refused_and_refusals_count(self):
        # Characterises current behaviour (BUG-55, pinned; flips in PR A: confirm 20 an hour, refresh 60 a minute)
        confirm = {"uid": "MQ", "token": "spent", "new_password": "crimson-lantern-42"}
        self.assertEqual({self.from_table(RESET_CONFIRM, confirm).status_code for _ in range(10)}, {400})
        self.assert_throttled(self.from_table(RESET_CONFIRM, confirm), 3600)

        self.assertEqual({self.from_table(REFRESH, {"refresh": "garbage"}).status_code for _ in range(30)}, {401})
        self.assert_throttled(self.from_table(REFRESH, {"refresh": "garbage"}), 60)

    def test_one_email_from_many_addresses_is_never_throttled(self):
        # Characterises current behaviour (SEC-04, BUG-55, pinned; flips in PR A: 10 a minute and 30 an hour per
        # email, so the 11th answers 429)
        attempts = [self.from_table(LOGIN, {"email": "pia@example.com", "password": "guess"}, f"198.51.100.{n}") for n in range(11)]  # fmt: skip

        self.assertEqual({response.status_code for response in attempts}, {400})

    def test_a_rotating_forwarded_header_gets_a_fresh_bucket_each_time(self):
        # Characterises current behaviour (SEC-04, pinned; flips in PR A: startup refuses to run without
        # RATE_LIMIT_NUM_PROXIES): with NUM_PROXIES unset the whole header is the identity, and a client can send any
        attempts = [self.from_table(LOGIN, {"email": "pia@example.com", "password": "guess"}, f"10.9.8.{n}, 203.0.113.5") for n in range(8)]  # fmt: skip

        self.assertEqual({response.status_code for response in attempts}, {400})

    @override_settings(REST_FRAMEWORK=rest_framework(1))
    def test_with_one_proxy_a_rotating_spoofed_prefix_does_not_reset_the_count(self):
        # AUTH-TEST-17: the intended setting; the identity is the address Render's proxy appended
        attempts = [self.from_table(LOGIN, {"email": "pia@example.com", "password": "guess"}, f"10.9.8.{n}, 203.0.113.5") for n in range(6)]  # fmt: skip

        self.assertEqual([response.status_code for response in attempts], [400] * 5 + [429])

    @override_settings(RATE_LIMIT_ENABLED=False)
    def test_the_kill_switch_turns_every_auth_throttle_off(self):
        attempts = [self.from_table(LOGIN, {"email": "pia@example.com", "password": "guess"}) for _ in range(7)]

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
        # Characterises current behaviour (SEC-04, pinned; flips in PR A: RATE_LIMIT_NUM_PROXIES required)
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
    def test_the_auth_endpoints_throttle_per_address_only_at_these_rates(self):
        # Characterises current behaviour (BUG-55, SEC-04, pinned; flips in PR A: per-email scopes and new rates)
        ip = IPRateThrottle
        endpoints: dict[Any, list[tuple[str, str, type]]] = {
            views.LoginView: [("auth_login_minute", "5/min", ip), ("auth_login_hour", "30/hour", ip)],
            views.RegisterView: [("auth_register_hour", "3/hour", ip), ("auth_register_day", "10/day", ip)],
            views.PasswordResetRequestView: [
                ("auth_password_reset_hour", "3/hour", ip),
                ("auth_password_reset_day", "10/day", ip),
            ],
            views.PasswordResetConfirmView: [("auth_password_reset_confirm_hour", "10/hour", ip)],
            views.RefreshView: [("auth_refresh_minute", "30/min", ip)],
            views.FeedbackReportView: [
                ("feedback_report_user", "3/min", UserOrIPRateThrottle),
                ("feedback_report_ip", "10/min", ip),
            ],
            views.MeView: [],
            HealthView: [],
            KeepAwakeView: [],
        }
        for view, expected in endpoints.items():
            with self.subTest(view=view.__name__):
                self.assertEqual(scopes(view), expected)

    def test_counters_live_in_a_per_process_locmem_cache_at_its_default_size(self):
        # Characterises current behaviour (SEC-04, pinned; flips in PR A: MAX_ENTRIES 10,000): 300 entries, a third
        # culled when full, so many addresses evict real histories; each gunicorn worker has its own
        self.assertEqual(settings.CACHES["default"], {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "rate-limit"})  # fmt: skip
        store: Any = caches["default"]
        self.assertEqual((store._max_entries, store._cull_frequency), (300, 3))
