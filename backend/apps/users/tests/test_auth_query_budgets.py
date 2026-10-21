"""Query budgets for auth and core at today's counts (pass 6; AUTH-TEST-01, -05, -07, -08, -14).

Real JWTs, so a signed-in request's count includes the JWT user lookup, as in production. Counts are exact: a
change that makes a request cheaper lowers its budget in the same commit. PR A's targets (the brief's table): login
<= 2, register <= 3, refresh 1 (it starts loading the user and the session key), me 1 (user and account joined),
health and keep-awake 0 with any header, password change and sign out others <= 4.
"""

from collections.abc import Callable
from typing import Any
from unittest import mock

from django.test import override_settings

from .auth_support import (
    FEEDBACK,
    LOGIN,
    ME,
    NEW_PASSWORD,
    PASSWORD,
    REGISTER,
    RESET,
    RESET_CONFIRM,
    AuthTestCase,
    reset_link_parts,
)

HEALTH = "/api/health/"
KEEP_AWAKE = "/api/keep-awake/"


class AuthQueryBudgetTests(AuthTestCase):
    def assert_queries(self, count: int, status: int, call: Callable[..., Any], *args: Any, **kwargs: Any) -> None:
        """`call(*args, **kwargs)` answers `status` within exactly `count` queries."""
        with self.assertNumQueries(count):
            response = call(*args, **kwargs)
        self.assertEqual(response.status_code, status, getattr(response, "data", None))

    def test_login_runs_two_queries_and_a_refused_one_one(self):
        # AUTH-TEST-05: the user by username, then last_login's UPDATE on success (BUG-154; was 1); no
        # outstanding-token row
        cases = {
            "success": ("pia@example.com", PASSWORD, 200, 2),
            "wrong password": ("pia@example.com", "guess-again", 400, 1),
            "unknown email": ("nobody@example.com", PASSWORD, 400, 1),
        }
        for label, (email, password, status, count) in cases.items():
            with self.subTest(login=label):
                self.assert_queries(count, status, self.post, LOGIN, {"email": email, "password": password})

    def test_register_runs_three_statements_and_a_savepoint_pair(self):
        # AUTH-TEST-01: validate_email's EXISTS, then the user's and the account's INSERTs inside a savepoint, so a
        # simultaneous sign-up's IntegrityError answers 400 (BUG-84, SEC-05; was 2 queries); a taken email stops after
        # the first
        self.assert_queries(
            5, 201, self.post, REGISTER, {"email": "rex@example.com", "password": PASSWORD, "name": "Rex"}
        )
        self.assert_queries(
            1, 400, self.post, REGISTER, {"email": "pia@example.com", "password": PASSWORD, "name": "Pia"}
        )

    def test_refresh_runs_one_query(self):
        # SEC-05, AUTH-TEST-07 (was pinned at 0: it never loaded the user; flipped in PR A: the user and its account)
        refresh = self.sign_in()["refresh"]

        self.assert_queries(1, 200, self.refresh, refresh)

    def test_me_runs_one_query(self):
        # AUTH-TEST-08: the JWT user lookup, joined to the account for the session key, is the whole cost
        client = self.bearer(self.sign_in()["access"])

        self.assert_queries(1, 200, client.get, ME)

    @mock.patch("apps.users.views.send_password_reset_email", return_value=True)
    def test_a_reset_request_runs_one_query_for_a_known_email_and_an_unknown(self, _send):
        # BUG-153 (was pinned at 3 and 1: _get_user_by_email loaded only id and email, then make_token read last_login
        # and password, one deferred load each, two Neon round trips telling a known address from an unknown one)
        self.assert_queries(1, 200, self.post, RESET, {"email": "pia@example.com"})
        self.assert_queries(1, 200, self.post, RESET, {"email": "nobody@example.com"})

    def test_a_reset_confirm_runs_three_queries_and_a_refused_one_one(self):
        uid, token = reset_link_parts(self.pia)
        body = {"uid": uid, "token": token, "new_password": NEW_PASSWORD}

        # the user, the new session key (SEC-05; was 2), then the password UPDATE
        self.assert_queries(3, 200, self.post, RESET_CONFIRM, body)
        self.assert_queries(1, 400, self.post, RESET_CONFIRM, body)  # the link is spent

    @override_settings(RESEND_API_KEY="re_test", FEEDBACK_REPORT_TO_EMAIL="bugs@example.com")
    def test_a_feedback_report_runs_one_query(self):
        client = self.bearer(self.sign_in()["access"])

        with mock.patch("apps.users.emails.requests.post"):
            self.assert_queries(1, 200, client.post, FEEDBACK, {"report_type": "Bug", "message": "Hi."}, format="json")

    def test_the_probes_run_no_query_without_a_token_and_one_with_a_token(self):
        # Characterises current behaviour (AUTH-PERF-04, AUTH-TEST-14, pinned; flips in PR A: 0 with any header)
        client = self.bearer(self.sign_in()["access"])

        self.assert_queries(0, 200, self.client.get, HEALTH)
        self.assert_queries(0, 204, self.client.head, KEEP_AWAKE)
        self.assert_queries(1, 200, client.get, HEALTH)
        self.assert_queries(1, 204, client.head, KEEP_AWAKE)
