"""Password reset today (pass 6; AUTH-TEST-09 to -12, BUG-56, BUG-83, SEC-12, AUTH-CQ-04 b).

`POST auth/password-reset/` looks for an active user by email or username in any case, builds
`{FRONTEND_URL}/reset-password?uid=…&token=…` and queues the email after commit; it answers the same "sent" message
whatever happened. Without RESEND_API_KEY it answers 503 `email_unavailable` for every address (PR A, BUG-56). `POST auth/password-reset-confirm/` checks Django's token (valid for PASSWORD_RESET_TIMEOUT, spent
once the password changes) and sets the new password. PR A answers 503 `email_unavailable` while Resend isn't
configured (BUG-56), moves the link into the fragment (SEC-12), catches bad uids (BUG-83) and validates the new
password against the user (AUTH-CQ-04 b).
"""

from datetime import datetime, timedelta
from typing import Any
from unittest import mock
from urllib.parse import parse_qs, urlsplit

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.test import override_settings
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from .auth_support import LOGIN, NEW_PASSWORD, PASSWORD, RESET, RESET_CONFIRM, AuthTestCase, make_user, reset_link_parts

SENT = {"detail": "If an account exists for that email, a reset link has been sent."}
INVALID = {"detail": "Invalid or expired token."}
SEND = "apps.users.views.send_password_reset_email"
UNAVAILABLE = {
    "detail": "Password reset by email isn't switched on yet. Ask the app's admin to reset your password.",
    "code": "email_unavailable",
    "fields": {},
}


@override_settings(RESEND_API_KEY="re_test")  # the send itself is mocked, or Resend's post is
class ResetRequestTests(AuthTestCase):
    @mock.patch(SEND, return_value=True)
    def test_a_known_and_an_unknown_email_get_the_same_answer(self, send):
        # AUTH-TEST-09
        known = self.post(RESET, {"email": "pia@example.com"})
        unknown = self.post(RESET, {"email": "nobody@example.com"})

        self.assertEqual((known.status_code, known.json()), (200, SENT))
        self.assertEqual((unknown.status_code, unknown.json()), (200, SENT))
        send.assert_called_once()
        to, url = send.call_args.args
        self.assertEqual(to, "pia@example.com")
        self.assertTrue(url.startswith(f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?uid="), url)

    @override_settings(FRONTEND_URL="https://mordheim.example.com/")
    @mock.patch(SEND, return_value=True)
    def test_the_link_carries_uid_and_token_in_the_query_string(self, send):
        # Characterises current behaviour (SEC-12, pinned; flips in PR A: `/reset-password#uid=…&token=…`)
        self.post(RESET, {"email": "pia@example.com"})

        link = urlsplit(send.call_args.args[1])
        self.assertEqual((link.scheme, link.netloc, link.path, link.fragment), ("https", "mordheim.example.com", "/reset-password", ""))  # fmt: skip
        query = parse_qs(link.query)
        self.assertEqual(sorted(query), ["token", "uid"])
        self.assertEqual(force_str(urlsafe_base64_decode(query["uid"][0])), str(self.pia.id))
        self.assertTrue(PasswordResetTokenGenerator().check_token(self.pia, query["token"][0]))

    @mock.patch(SEND, return_value=True)
    def test_the_email_is_matched_in_any_case_and_the_stored_address_is_used(self, send):
        self.post(RESET, {"email": "  PIA@Example.COM "})

        self.assertEqual(send.call_args.args[0], "pia@example.com")

    @mock.patch(SEND, return_value=True)
    def test_an_inactive_user_gets_the_same_answer_and_no_email(self, send):
        make_user("ina@example.com", "Ina", is_active=False)

        response = self.post(RESET, {"email": "ina@example.com"})

        self.assertEqual((response.status_code, response.json()), (200, SENT))
        send.assert_not_called()

    @override_settings(RESEND_API_KEY="")  # as production has it today
    def test_with_resend_unconfigured_every_address_gets_503_email_unavailable(self):
        # BUG-56, BUG-155 (was pinned: "a reset link has been sent", and a WARNING naming the address; flipped in PR A:
        # 503 for every address, before any lookup, logged at ERROR without the address)
        make_user("ina@example.com", "Ina", is_active=False)
        for email in ("pia@example.com", "nobody@example.com", "ina@example.com"):
            with self.subTest(email=email):
                with (
                    self.assertLogs("apps.users.emails", "WARNING") as logs,
                    mock.patch("apps.users.emails.requests.post") as post,
                    self.assertNumQueries(0),
                ):
                    response = self.post(RESET, {"email": email})

                self.assertEqual((response.status_code, response.json()), (503, UNAVAILABLE))
                post.assert_not_called()
                self.assertEqual(logs.output, ["ERROR:apps.users.emails:A password reset was requested, but RESEND_API_KEY isn't set: answered 503 email_unavailable"])  # fmt: skip

    @override_settings(RESEND_API_KEY="")
    def test_a_malformed_email_is_still_a_field_error_with_email_off(self):
        response = self.post(RESET, {"email": "pia"})

        self.assertEqual((response.status_code, response.json()), (400, {"email": ["Enter a valid email address."]}))

    @override_settings(RESEND_API_KEY="re_test", DEFAULT_FROM_EMAIL="no-reply@example.com", FRONTEND_URL="https://m.example.com")  # fmt: skip
    def test_with_resend_configured_the_email_is_posted_after_commit(self):
        with mock.patch("apps.users.emails.requests.post", return_value=mock.Mock(status_code=202, text="ok")) as post:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.post(RESET, {"email": "pia@example.com"})
                post.assert_not_called()  # nothing is sent before the commit

        self.assertEqual((response.status_code, response.json()), (200, SENT))
        post.assert_called_once()
        self.assertEqual(post.call_args.args, ("https://api.resend.com/emails",))
        sent = post.call_args.kwargs
        self.assertEqual((sent["headers"]["Authorization"], sent["timeout"]), ("Bearer re_test", (3, 10)))
        self.assertEqual(
            {key: sent["json"][key] for key in ("from", "to", "subject")},
            {"from": "no-reply@example.com", "to": ["pia@example.com"], "subject": "Reset your password"},
        )
        self.assertIn("https://m.example.com/reset-password?uid=", sent["json"]["text"])


class ResetConfirmTests(AuthTestCase):
    def confirm(self, uid: str, token: str, new_password: str = NEW_PASSWORD) -> Any:
        return self.post(RESET_CONFIRM, {"uid": uid, "token": token, "new_password": new_password})

    def test_a_valid_link_sets_the_new_password_once(self):
        # AUTH-TEST-10
        uid, token = reset_link_parts(self.pia)

        response = self.confirm(uid, token)

        self.assertEqual((response.status_code, response.json()), (200, {"detail": "Password has been reset."}))
        self.assertEqual(self.post(LOGIN, {"email": "pia@example.com", "password": NEW_PASSWORD}).status_code, 200)
        self.assertEqual(self.post(LOGIN, {"email": "pia@example.com", "password": PASSWORD}).status_code, 400)
        reused = self.confirm(uid, token, "another-lantern-77")
        self.assertEqual((reused.status_code, reused.json()), (400, INVALID))

    def test_a_link_is_valid_for_password_reset_timeout_seconds(self):
        # AUTH-TEST-11 (no freezegun in the dev dependencies: the generator's clock is moved instead)
        uid = urlsafe_base64_encode(force_bytes(self.pia.pk))
        timeout = settings.PASSWORD_RESET_TIMEOUT
        cases = {"just inside": (timeout - 60, 200), "just past": (timeout + 1, 400)}
        for label, (age, status) in cases.items():
            with self.subTest(link=label):
                made_at = datetime.now() - timedelta(seconds=age)
                with mock.patch.object(PasswordResetTokenGenerator, "_now", return_value=made_at):
                    token = PasswordResetTokenGenerator().make_token(self.pia)

                self.assertEqual(self.confirm(uid, token).status_code, status)

    def test_signing_in_spends_the_link(self):
        # BUG-154 (was: a link survived a sign-in for its full hour; fixed in PR A: login records last_login)
        uid, token = reset_link_parts(self.pia)
        self.sign_in()

        response = self.confirm(uid, token)

        self.assertEqual((response.status_code, response.json()), (400, INVALID))
        self.assertTrue(get_user_model().objects.get(id=self.pia.id).check_password(PASSWORD))

    def test_a_wrong_token_another_users_uid_or_an_inactive_user_is_refused(self):
        rex = make_user("rex@example.com", "Rex")
        ina = make_user("ina@example.com", "Ina", is_active=False)
        pia_uid, pia_token = reset_link_parts(self.pia)
        cases = {
            "wrong token": (pia_uid, "abc-123"),
            "another user's uid": (reset_link_parts(rex)[0], pia_token),
            "inactive user": reset_link_parts(ina),
        }
        for label, (uid, token) in cases.items():
            with self.subTest(case=label):
                response = self.confirm(uid, token)

                self.assertEqual((response.status_code, response.json()), (400, INVALID))

    def test_the_new_password_is_validated_against_the_user(self):
        # AUTH-CQ-04 b (was pinned: the address itself was accepted; flipped in PR A: the validators get the user)
        uid, token = reset_link_parts(self.pia)
        weak = self.confirm(uid, token, "12345678")
        self.assertEqual(weak.status_code, 400)
        self.assertEqual(weak.json(), {"new_password": ["This password is too common.", "This password is entirely numeric."]})  # fmt: skip

        same_as_email = self.confirm(uid, token, "pia@example.com")

        self.assertEqual((same_as_email.status_code, same_as_email.json()), (400, {"new_password": ["The password is too similar to the email address."]}))  # fmt: skip
        self.assertTrue(get_user_model().objects.get(id=self.pia.id).check_password(PASSWORD))
        self.assertEqual(self.confirm(uid, token).status_code, 200)  # a refused password leaves the link usable

    def test_uids_that_decode_to_nothing_usable_are_refused_or_field_errors(self):
        # AUTH-TEST-12, the cases that hold today: blank, a number beyond any id, bytes that aren't UTF-8, id 0
        _, token = reset_link_parts(self.pia)
        cases = {
            "blank": ("", {"uid": ["This field may not be blank."]}),
            "huge number": (urlsafe_base64_encode(b"9" * 30), INVALID),
            "not UTF-8": (urlsafe_base64_encode(b"\xff\xfe"), INVALID),
            "zero": (urlsafe_base64_encode(b"0"), INVALID),
        }
        for label, (uid, body) in cases.items():
            with self.subTest(uid=label):
                response = self.confirm(uid, token)

                self.assertEqual((response.status_code, response.json()), (400, body))

    def test_a_uid_that_decodes_to_letters_is_refused(self):
        """`YWJj` decodes to "abc"; `filter(pk="abc")` raised ValueError outside the try (a 500)."""
        # BUG-83, AUTH-TEST-12 (was an expected failure; fixed in PR A: _get_user_from_uid catches the lookup too)
        self.answer_errors_with_500()

        response = self.confirm("YWJj", reset_link_parts(self.pia)[1])

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), INVALID)

    def test_a_uid_of_punctuation_is_refused(self):
        """`!!!` decodes to an empty string (b64decode drops what isn't base64); `filter(pk="")` raised ValueError
        (a 500)."""
        # BUG-83, AUTH-TEST-12 (was an expected failure; fixed in PR A)
        self.answer_errors_with_500()

        response = self.confirm("!!!", reset_link_parts(self.pia)[1])

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), INVALID)
