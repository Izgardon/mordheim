"""The shared SSO flow: which providers show, the authorize URL, and what each failure answers.

The rule the frontend depends on: **no refusal here is ever a 401** (CLAUDE.md, "Sessions"), because a 401 after a
refresh signs the session out.
"""

from urllib.parse import parse_qs, urlparse

from django.test import override_settings

from apps.users.models import SsoLoginAttempt
from apps.users.services import sso
from apps.users.sso.client import TIMEOUT

from .sso_support import PROVIDERS, SsoTestCase, callback_url, start_url


class ProviderListTests(SsoTestCase):
    def test_a_configured_provider_is_offered(self):
        response = self.client.get(PROVIDERS)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"providers": [{"slug": "google", "label": "Google"}, {"slug": "discord", "label": "Discord"}]},
        )

    @override_settings(DISCORD_OAUTH_CLIENT_SECRET="")
    def test_a_provider_missing_half_its_credentials_is_left_out_and_refuses_a_start(self):
        response = self.client.get(PROVIDERS)
        self.assertEqual(response.json(), {"providers": [{"slug": "google", "label": "Google"}]})

        started = self.client.get(start_url("discord"))
        self.assertEqual((started.status_code, started.json()["code"]), (503, "sso_not_configured"))

    def test_an_unknown_provider_is_a_400(self):
        response = self.client.get(start_url("facebook"))

        self.assertEqual((response.status_code, response.json()["code"]), (400, "sso_unknown_provider"))

    def test_the_list_needs_no_sign_in_and_names_no_credentials(self):
        body = self.client.get(PROVIDERS).content.decode()

        self.assertNotIn("client-secret", body)
        self.assertNotIn("client-id", body)


class StartTests(SsoTestCase):
    def test_the_authorize_url_carries_pkce_the_state_and_the_frontends_redirect_uri(self):
        attempt = self.begin()
        url = urlparse(attempt["authorize_url"])
        query = {key: value[0] for key, value in parse_qs(url.query).items()}

        self.assertEqual(f"{url.scheme}://{url.netloc}{url.path}", "https://accounts.google.com/o/oauth2/v2/auth")
        self.assertEqual(query["response_type"], "code")
        self.assertEqual(query["client_id"], "google-client-id")
        self.assertEqual(query["redirect_uri"], "http://localhost:5173/auth/callback/google")
        self.assertEqual(query["code_challenge_method"], "S256")
        self.assertEqual(query["state"], attempt["state"])
        self.assertEqual(query["scope"], "openid email profile")
        self.assertNotIn("google-client-secret", attempt["authorize_url"])
        # The verifier never leaves the server, only its challenge.
        self.assertNotIn(query["code_challenge"], (attempt["browser_token"], attempt["state"]))

    def test_the_verifier_is_kept_here_and_only_the_browser_secrets_hash_is_stored(self):
        attempt = self.begin()
        row = SsoLoginAttempt.objects.get(state=attempt["state"])

        self.assertEqual(len(row.code_verifier), 86)
        self.assertNotIn(row.code_verifier, attempt["authorize_url"])
        self.assertNotEqual(row.browser_hash, attempt["browser_token"])
        self.assertEqual(len(row.browser_hash), 64)
        self.assertIsNone(row.consumed_at)

    def test_discords_authorize_url_is_its_own(self):
        url = urlparse(self.begin("discord")["authorize_url"])
        query = {key: value[0] for key, value in parse_qs(url.query).items()}

        self.assertEqual(f"{url.scheme}://{url.netloc}{url.path}", "https://discord.com/oauth2/authorize")
        self.assertEqual(query["redirect_uri"], "http://localhost:5173/auth/callback/discord")
        self.assertEqual(query["scope"], "identify email")

    def test_a_start_drops_attempts_past_their_ten_minutes(self):
        stale = SsoLoginAttempt.objects.create(
            provider="google", state="stale", code_verifier="v", browser_hash="h", redirect_uri="u"
        )
        SsoLoginAttempt.objects.filter(pk=stale.pk).update(created_at=stale.created_at - sso.ATTEMPT_TTL * 2)

        self.begin()

        self.assertFalse(SsoLoginAttempt.objects.filter(pk=stale.pk).exists())


class StateTests(SsoTestCase):
    """A state is single-use, short-lived, tied to its provider and tied to the browser that started it."""

    def assert_state_refused(self, response) -> None:
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "sso_invalid_state")

    def test_a_replayed_state_is_refused_the_second_time(self):
        attempt = self.begin()
        fields = {"state": attempt["state"], "browser_token": attempt["browser_token"]}

        self.assertEqual(self.callback(**fields).status_code, 200)  # links to Pia's account
        self.assert_state_refused(self.callback(**fields))

    def test_a_forged_state_is_refused(self):
        self.assert_state_refused(self.callback(state="made-up", browser_token="made-up-too"))

    def test_a_state_from_another_browser_is_refused(self):
        attempt = self.begin()

        self.assert_state_refused(self.callback(state=attempt["state"], browser_token="another-browsers-secret"))

    def test_a_state_started_for_another_provider_is_refused(self):
        attempt = self.begin("google")

        self.assert_state_refused(
            self.callback("discord", state=attempt["state"], browser_token=attempt["browser_token"])
        )

    def test_a_state_older_than_its_ten_minutes_is_refused(self):
        attempt = self.begin()
        row = SsoLoginAttempt.objects.get(state=attempt["state"])
        SsoLoginAttempt.objects.filter(pk=row.pk).update(created_at=row.created_at - sso.ATTEMPT_TTL * 2)

        self.assert_state_refused(self.callback(state=attempt["state"], browser_token=attempt["browser_token"]))

    def test_a_refused_state_never_reaches_the_provider(self):
        self.callback(state="made-up", browser_token="made-up-too")

        self.exchange.assert_not_called()
        self.fetch.assert_not_called()


class ProviderFailureTests(SsoTestCase):
    def test_a_provider_refusing_the_code_is_a_400_with_no_detail_from_the_provider(self):
        from apps.users.sso.base import EXCHANGE_FAILED, SsoError

        self.exchange.side_effect = SsoError(EXCHANGE_FAILED, 400, "That sign-in couldn't be completed.")

        response = self.callback()

        self.assertEqual((response.status_code, response.json()["code"]), (400, "sso_exchange_failed"))

    def test_an_unreachable_provider_is_a_503(self):
        from apps.users.sso.base import PROVIDER_UNAVAILABLE, SsoError

        self.exchange.side_effect = SsoError(PROVIDER_UNAVAILABLE, 503, "Couldn't reach Google just now.")

        response = self.callback()

        self.assertEqual((response.status_code, response.json()["code"]), (503, "sso_provider_unavailable"))

    def test_a_profile_without_a_subject_is_a_400(self):
        from .sso_support import profile

        response = self.sign_in_with(profile(subject=""))

        self.assertEqual((response.status_code, response.json()["code"]), (400, "sso_no_subject"))

    def test_a_missing_code_or_state_is_a_400(self):
        response = self.post(callback_url(), {"code": "c"})

        self.assertEqual(response.status_code, 400)

    def test_no_failure_answers_a_401(self):
        """A 401 after a refresh signs the frontend out, so no SSO refusal may be one."""
        from apps.users.sso.base import SsoError

        attempts = [
            lambda: self.client.get(start_url("facebook")),
            lambda: self.callback(state="made-up", browser_token="made-up-too"),
            lambda: self.post(callback_url(), {}),
        ]
        for make_request in attempts:
            self.assertNotEqual(make_request().status_code, 401)

        self.exchange.side_effect = SsoError("sso_exchange_failed", 400, "no")
        self.assertNotEqual(self.callback().status_code, 401)

    def test_the_providers_timeouts_are_short(self):
        self.assertEqual(TIMEOUT, (5, 10))


class QueryBudgetTests(SsoTestCase):
    """A sign-in's queries are a fixed handful: the attempt (locked, then consumed), the identity with its user and
    the user's session key in one row, the identity's touch, and last_login."""

    def test_an_already_linked_sign_in_costs_a_fixed_number_of_queries(self):
        from .sso_support import profile

        attempt = self.begin()
        self.fetch.return_value = profile(subject="g-budget", email="pia@example.com")
        self.callback(state=attempt["state"], browser_token=attempt["browser_token"])
        again = self.begin()

        with self.assertNumQueries(9):
            response = self.callback(state=again["state"], browser_token=again["browser_token"])

        self.assertEqual(response.status_code, 200)
