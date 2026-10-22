"""Changing your password and signing out everywhere else (pass 6 PR A; AUTH-NEW-03, -04 server half, decisions 1
and 4, AUTH-CQ-04 b).

`POST auth/password/` takes the current and a new password; `POST auth/sign-out-others/` takes nothing. Both give the
user a new session key, so every other device's tokens answer 401 `session_ended`, and answer `{access, refresh,
user}` for the device that asked. They share a throttle of 5 a minute per user.
"""

from typing import Any

from django.contrib.auth import get_user_model

from apps.users.models import UserAccount

from .auth_support import LOGIN, ME, NEW_PASSWORD, PASSWORD, AuthTestCase, access_claims, make_user

PASSWORD_CHANGE = "/api/auth/password/"
SIGN_OUT_OTHERS = "/api/auth/sign-out-others/"
SESSION_ENDED = {"detail": "Your session has ended. Please sign in again.", "code": "session_ended"}
PIA = {"id": None, "email": "pia@example.com", "name": "Pia"}


class AccountSessionTestCase(AuthTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.phone, self.laptop = self.sign_in(), self.sign_in()  # two devices, two pairs

    def change_password(self, body: dict[str, Any], tokens: dict[str, str] | None = None) -> Any:
        return self.bearer((tokens or self.laptop)["access"]).post(PASSWORD_CHANGE, body, format="json")

    def assert_session_ended(self, tokens: dict[str, str]) -> None:
        for label, response in (("access", self.me(tokens["access"])), ("refresh", self.refresh(tokens["refresh"]))):
            with self.subTest(token=label):
                self.assertEqual((response.status_code, response.json()), (401, SESSION_ENDED))

    def assert_fresh_pair(self, response: Any) -> dict[str, str]:
        """The answer is a working pair for this device, carrying the user's new key, and the user."""
        self.assertEqual(response.status_code, 200, response.json())
        body = response.json()
        self.assertEqual(sorted(body), ["access", "refresh", "user"])
        self.assertEqual(body["user"], {**PIA, "id": self.pia.id})
        key = str(UserAccount.objects.get(user=self.pia).session_key)
        self.assertEqual(access_claims(body["access"])["sk"], key)
        self.assertEqual(self.me(body["access"]).status_code, 200)
        self.assertEqual(self.refresh(body["refresh"]).status_code, 200)
        return {"access": body["access"], "refresh": body["refresh"]}


class PasswordChangeTests(AccountSessionTestCase):
    def test_a_change_signs_out_every_other_device_and_keeps_this_one(self):
        response = self.change_password({"current_password": PASSWORD, "new_password": NEW_PASSWORD})

        self.assert_fresh_pair(response)
        self.assert_session_ended(self.phone)
        self.assert_session_ended(self.laptop)  # the pair it was sent with is replaced too
        self.assertEqual(self.post(LOGIN, {"email": "pia@example.com", "password": NEW_PASSWORD}).status_code, 200)
        self.assertEqual(self.post(LOGIN, {"email": "pia@example.com", "password": PASSWORD}).status_code, 400)

    def test_a_wrong_current_password_changes_nothing(self):
        key = UserAccount.objects.get(user=self.pia).session_key

        response = self.change_password({"current_password": "not-my-password", "new_password": NEW_PASSWORD})

        self.assertEqual((response.status_code, response.json()), (400, {"current_password": ["That isn't your current password."]}))  # fmt: skip
        self.assertEqual(UserAccount.objects.get(user=self.pia).session_key, key)
        self.assertTrue(get_user_model().objects.get(id=self.pia.id).check_password(PASSWORD))
        self.assertEqual(self.me(self.phone["access"]).status_code, 200)

    def test_the_new_password_is_validated_against_the_user(self):
        # AUTH-CQ-04 b: the same validators as sign-up and reset, given the user
        cases = {
            "like the email": (
                "pia@example.com",
                {"new_password": ["The password is too similar to the email address."]},
            ),  # fmt: skip
            "common and numeric": (
                "12345678",
                {"new_password": ["This password is too common.", "This password is entirely numeric."]},
            ),  # fmt: skip
            "short": ("short", {"new_password": ["Ensure this field has at least 8 characters."]}),
            "missing": (None, {"new_password": ["This field is required."]}),
        }
        for label, (new_password, errors) in cases.items():
            with self.subTest(case=label):
                body = {"current_password": PASSWORD, **({"new_password": new_password} if new_password else {})}

                response = self.change_password(body)

                self.assertEqual((response.status_code, response.json()), (400, errors))
        self.assertTrue(get_user_model().objects.get(id=self.pia.id).check_password(PASSWORD))
        self.assertEqual(self.me(self.phone["access"]).status_code, 200)

    def test_it_needs_a_signed_in_user_and_answers_only_post(self):
        anonymous = self.client.post(PASSWORD_CHANGE, {"current_password": PASSWORD, "new_password": NEW_PASSWORD})

        self.assertEqual(anonymous.status_code, 401)
        self.assertEqual(self.bearer(self.laptop["access"]).get(PASSWORD_CHANGE).status_code, 405)

    def test_a_change_runs_three_queries(self):
        # The user and account, the new session key, the password's UPDATE (the brief's budget: at most 4)
        client = self.bearer(self.laptop["access"])

        with self.assertNumQueries(3):
            response = client.post(PASSWORD_CHANGE, {"current_password": PASSWORD, "new_password": NEW_PASSWORD})

        self.assertEqual(response.status_code, 200)


class SignOutOthersTests(AccountSessionTestCase):
    def test_every_other_device_is_signed_out_and_this_one_gets_a_fresh_pair(self):
        response = self.bearer(self.laptop["access"]).post(SIGN_OUT_OTHERS)

        fresh = self.assert_fresh_pair(response)
        self.assert_session_ended(self.phone)
        self.assert_session_ended(self.laptop)
        self.assertTrue(get_user_model().objects.get(id=self.pia.id).check_password(PASSWORD))
        self.assertEqual(self.bearer(fresh["access"]).get(ME).status_code, 200)

    def test_it_needs_a_signed_in_user_and_answers_only_post(self):
        self.assertEqual(self.client.post(SIGN_OUT_OTHERS).status_code, 401)
        self.assertEqual(self.bearer(self.laptop["access"]).get(SIGN_OUT_OTHERS).status_code, 405)

    def test_it_runs_two_queries(self):
        # The user and account, then the new session key (the brief's budget: at most 4)
        client = self.bearer(self.laptop["access"])

        with self.assertNumQueries(2):
            response = client.post(SIGN_OUT_OTHERS)

        self.assertEqual(response.status_code, 200)


class AccountThrottleTests(AccountSessionTestCase):
    def test_the_password_change_and_sign_out_others_share_five_a_minute_per_user(self):
        # The Calls: password change, sign out others (and PR C's delete) 5 a minute per user
        tokens = self.laptop
        for _ in range(3):
            response = self.bearer(tokens["access"]).post(SIGN_OUT_OTHERS)
            self.assertEqual(response.status_code, 200)
            tokens = {"access": response.json()["access"], "refresh": response.json()["refresh"]}
        wrong = {"current_password": "not-my-password", "new_password": NEW_PASSWORD}
        self.assertEqual(self.change_password(wrong, tokens).status_code, 400)  # refusals count too
        self.assertEqual(self.change_password(wrong, tokens).status_code, 400)

        throttled = self.bearer(tokens["access"]).post(SIGN_OUT_OTHERS)

        self.assertEqual(throttled.status_code, 429)
        rex = self.bearer(self.sign_in_rex()["access"]).post(SIGN_OUT_OTHERS)
        self.assertEqual(rex.status_code, 200)  # another user has his own budget

    def sign_in_rex(self) -> dict[str, str]:
        make_user("rex@example.com", "Rex")
        return self.sign_in("rex@example.com")
