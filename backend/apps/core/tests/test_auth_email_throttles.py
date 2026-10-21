"""The per-email auth limits (pass 6 PR A; BUG-55, SEC-04).

Login allows 10 a minute and 30 an hour per email, and the reset request 3 an hour per email, whichever addresses the
requests come from. The email is read from the body, trimmed and lowercased, and hashed into the cache key; a body
without an email string isn't counted by these.
"""

from typing import Any
from unittest import mock

from django.core.cache import caches
from django.test import override_settings
from rest_framework.throttling import SimpleRateThrottle

from apps.users.tests.auth_support import LOGIN, PASSWORD, RESET

from .test_auth_throttle_characterisation import FAST_HASHERS, TableTestCase, rest_framework


@override_settings(RATE_LIMIT_ENABLED=True, REST_FRAMEWORK=rest_framework(1), PASSWORD_HASHERS=FAST_HASHERS)
class EmailThrottleTests(TableTestCase):
    def guess(self, email: str, n: int) -> Any:
        """A wrong-password sign-in for `email` from its own address."""
        return self.from_table(LOGIN, {"email": email, "password": "guess"}, f"198.51.100.{n}")

    def test_one_email_is_refused_after_thirty_sign_ins_an_hour(self):
        # Three bursts of 10, a minute apart, then a fourth minute: the hourly limit refuses it
        clock = mock.Mock(return_value=1_000_000.0)
        with mock.patch.object(SimpleRateThrottle, "timer", clock):
            for burst in range(3):
                clock.return_value = 1_000_000.0 + burst * 61
                for n in range(10):
                    self.assertEqual(self.guess("pia@example.com", burst * 10 + n).status_code, 400)
            clock.return_value = 1_000_000.0 + 3 * 61 + 1

            self.assert_throttled(self.guess("pia@example.com", 99), 3600 - 3 * 61)

    def test_the_email_is_matched_trimmed_and_in_any_case(self):
        variants = ["pia@example.com", "PIA@Example.com", "  pia@example.COM  "]
        for n in range(10):
            self.assertEqual(self.guess(variants[n % 3], n).status_code, 400)

        self.assertEqual(self.guess("Pia@Example.Com", 50).status_code, 429)

    def test_another_email_from_the_same_addresses_is_not_held_up(self):
        for n in range(10):
            self.guess("pia@example.com", n)

        self.assertEqual(self.guess("pia@example.com", 10).status_code, 429)
        self.assertEqual(self.from_table(LOGIN, {"email": "player0@example.com", "password": PASSWORD}, "198.51.100.10").status_code, 200)  # fmt: skip

    def test_a_body_without_an_email_string_is_counted_by_address_only(self):
        bodies: list[Any] = [{"password": "guess"}, {"email": 5, "password": "guess"}, {"email": "  ", "password": "guess"}]  # fmt: skip
        for n in range(12):
            response = self.from_table(LOGIN, bodies[n % 3], f"198.51.100.{n}")
            self.assertEqual(response.status_code, 400)

    @mock.patch("apps.users.views.send_password_reset_email", return_value=True)
    def test_one_email_is_refused_after_three_reset_requests_an_hour(self, _send):
        for n in range(3):
            self.assertEqual(self.from_table(RESET, {"email": "pia@example.com"}, f"198.51.100.{n}").status_code, 200)

        self.assert_throttled(self.from_table(RESET, {"email": "pia@example.com"}, "198.51.100.9"), 3600)
        self.assertEqual(self.from_table(RESET, {"email": "player0@example.com"}, "198.51.100.9").status_code, 200)

    def test_the_cache_key_holds_a_hash_not_the_address(self):
        self.guess("pia@example.com", 1)

        keys = [str(key) for key in caches["default"]._cache]  # type: ignore[attr-defined]
        self.assertTrue(any("auth_login_email_minute_email:" in key for key in keys), keys)
        self.assertFalse(any("pia" in key for key in keys), keys)
