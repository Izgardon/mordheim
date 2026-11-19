"""The per-provider modules and the two HTTP calls, with `requests` mocked.

The test runner refuses any non-loopback connection, so these mock `requests` itself rather than letting a call out.
"""

from unittest.mock import patch

from django.test import SimpleTestCase

from apps.users.sso import client, discord, google
from apps.users.sso.base import SsoError
from apps.users.sso.registry import PROVIDERS


class FakeResponse:
    def __init__(self, payload: object, status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code

    def json(self) -> object:
        if self._payload is None:
            raise ValueError("no json")
        return self._payload


class GoogleProfileTests(SimpleTestCase):
    def test_a_verified_google_account(self):
        read = google.read_profile({"sub": "123", "email": "Nell@Example.com", "email_verified": True, "name": "Nell"})

        self.assertEqual(
            (read.subject, read.email, read.email_verified, read.name), ("123", "nell@example.com", True, "Nell")
        )

    def test_google_sending_its_flag_as_a_string(self):
        self.assertTrue(google.read_profile({"sub": "1", "email": "a@b.co", "email_verified": "true"}).email_verified)

    def test_an_unverified_or_missing_email_is_never_verified(self):
        self.assertFalse(google.read_profile({"sub": "1", "email": "a@b.co", "email_verified": False}).email_verified)
        self.assertFalse(google.read_profile({"sub": "1", "email_verified": True}).email_verified)

    def test_the_given_name_stands_in_for_a_missing_name(self):
        self.assertEqual(google.read_profile({"sub": "1", "given_name": "Nell"}).name, "Nell")


class DiscordProfileTests(SimpleTestCase):
    def test_a_verified_discord_account_uses_its_global_name(self):
        read = discord.read_profile(
            {"id": "99", "email": "Nell@Example.com", "verified": True, "global_name": "Nell", "username": "nell99"}
        )

        self.assertEqual(
            (read.subject, read.email, read.email_verified, read.name), ("99", "nell@example.com", True, "Nell")
        )

    def test_the_handle_stands_in_for_a_missing_global_name(self):
        self.assertEqual(discord.read_profile({"id": "99", "username": "nell99"}).name, "nell99")

    def test_an_unverified_discord_email_is_not_verified(self):
        self.assertFalse(discord.read_profile({"id": "99", "email": "a@b.co", "verified": False}).email_verified)


class ExchangeTests(SimpleTestCase):
    provider = PROVIDERS["google"]

    def test_the_code_the_verifier_and_the_secret_go_to_the_providers_token_endpoint(self):
        with self.settings(GOOGLE_OAUTH_CLIENT_ID="cid", GOOGLE_OAUTH_CLIENT_SECRET="secret"):
            with patch.object(client.requests, "post", return_value=FakeResponse({"access_token": "at"})) as post:
                token = client.exchange_code(self.provider, "the-code", "https://app/cb", "the-verifier")

        self.assertEqual(token, "at")
        sent = post.call_args.kwargs["data"]
        self.assertEqual(sent["grant_type"], "authorization_code")
        self.assertEqual(sent["code"], "the-code")
        self.assertEqual(sent["code_verifier"], "the-verifier")
        self.assertEqual(sent["redirect_uri"], "https://app/cb")
        self.assertEqual((sent["client_id"], sent["client_secret"]), ("cid", "secret"))
        self.assertEqual(post.call_args.kwargs["timeout"], client.TIMEOUT)

    def test_a_refused_code_is_a_400_that_repeats_nothing_the_provider_said(self):
        body = {"error": "invalid_grant", "error_description": "Bad code (client secret leak bait)"}
        with patch.object(client.requests, "post", return_value=FakeResponse(body, status_code=400)):
            with self.assertRaises(SsoError) as refused:
                client.exchange_code(self.provider, "c", "u", "v")

        self.assertEqual((refused.exception.status, refused.exception.code), (400, "sso_exchange_failed"))
        self.assertNotIn("invalid_grant", refused.exception.detail)

    def test_a_token_answer_without_a_token_is_refused(self):
        with patch.object(client.requests, "post", return_value=FakeResponse({"token_type": "Bearer"})):
            with self.assertRaises(SsoError) as refused:
                client.exchange_code(self.provider, "c", "u", "v")

        self.assertEqual(refused.exception.code, "sso_exchange_failed")

    def test_an_unreachable_provider_is_a_503(self):
        with patch.object(client.requests, "post", side_effect=client.requests.ConnectionError()):
            with self.assertRaises(SsoError) as refused:
                client.exchange_code(self.provider, "c", "u", "v")

        self.assertEqual((refused.exception.status, refused.exception.code), (503, "sso_provider_unavailable"))


class FetchProfileTests(SimpleTestCase):
    provider = PROVIDERS["discord"]

    def test_the_profile_is_read_with_the_providers_access_token(self):
        payload = {"id": "99", "email": "a@b.co", "verified": True, "global_name": "Nell"}
        with patch.object(client.requests, "get", return_value=FakeResponse(payload)) as get:
            read = client.fetch_profile(self.provider, "at")

        self.assertEqual(read.subject, "99")
        self.assertEqual(get.call_args.kwargs["headers"]["Authorization"], "Bearer at")
        self.assertEqual(get.call_args.args[0], "https://discord.com/api/users/@me")

    def test_a_refused_profile_is_a_400(self):
        with patch.object(client.requests, "get", return_value=FakeResponse(None, status_code=401)):
            with self.assertRaises(SsoError) as refused:
                client.fetch_profile(self.provider, "at")

        # The provider's own 401 must never become ours: a 401 would sign the frontend out.
        self.assertEqual((refused.exception.status, refused.exception.code), (400, "sso_exchange_failed"))
