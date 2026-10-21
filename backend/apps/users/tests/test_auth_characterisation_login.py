"""Sign-in today (pass 6; AUTH-TEST-05, -06, AUTH-CQ-04 a, PERF-50, SEC-05).

`POST auth/login/` trims and lowercases the email, calls `authenticate(username=email)` and answers a SimpleJWT
pair: access for 1 day, refresh for 30, with no other claims. PR A returns the user beside the pair (PERF-50's
server half), makes `email` a real EmailField (IMP-95 a) and adds the session key claim `sk` (SEC-05).
"""

from datetime import timedelta
from typing import Any

from .auth_support import LOGIN, PASSWORD, AuthTestCase, access_claims, make_user, refresh_claims

INVALID = {"non_field_errors": ["Invalid credentials"]}


class LoginTests(AuthTestCase):
    def login(self, email: str, password: str = PASSWORD, **extra: str) -> Any:
        return self.post(LOGIN, {"email": email, "password": password}, **extra)

    def test_a_correct_login_answers_only_the_token_pair(self):
        # Characterises current behaviour (PERF-50 server half, pinned; flips in PR A: {access, refresh, user})
        response = self.login("pia@example.com")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(sorted(response.json()), ["access", "refresh"])
        self.assertEqual(self.me(response.json()["access"]).json()["id"], self.pia.id)

    def test_the_tokens_carry_only_simplejwts_claims_and_lifetimes(self):
        # Characterises current behaviour (SEC-05, BUG-140, pinned; flips in PR A: the session key claim `sk`)
        tokens = self.sign_in()
        access, refresh = access_claims(tokens["access"]), refresh_claims(tokens["refresh"])

        for claims, kind, lifetime in ((access, "access", timedelta(days=1)), (refresh, "refresh", timedelta(days=30))):
            with self.subTest(token=kind):
                self.assertEqual(sorted(claims), ["exp", "iat", "jti", "token_type", "user_id"])
                self.assertEqual((claims["token_type"], claims["user_id"]), (kind, self.pia.id))
                self.assertEqual(timedelta(seconds=claims["exp"] - claims["iat"]), lifetime)

    def test_wrong_password_unknown_email_and_inactive_user_get_one_identical_400(self):
        # AUTH-TEST-05: nothing tells the three apart
        make_user("ina@example.com", "Ina", is_active=False)
        attempts = {
            "wrong password": self.login("pia@example.com", "not-the-password"),
            "unknown email": self.login("nobody@example.com"),
            "inactive user": self.login("ina@example.com"),
        }
        for label, response in attempts.items():
            with self.subTest(case=label):
                self.assertEqual((response.status_code, response.json()), (400, INVALID))

    def test_odd_casing_and_spaces_in_the_email_still_sign_in(self):
        # AUTH-TEST-06
        for email in ("PIA@Example.COM", "  pia@example.com  "):
            with self.subTest(email=email):
                self.assertEqual(self.login(email).status_code, 200)

    def test_an_email_that_is_not_an_address_is_a_field_error(self):
        # AUTH-CQ-04 a, IMP-95 a (was pinned: just "Invalid credentials", since TokenObtainSerializer.__init__ replaced
        # the declared EmailField with a CharField; flipped in PR A)
        response = self.login("pia")

        self.assertEqual((response.status_code, response.json()), (400, {"email": ["Enter a valid email address."]}))

    def test_missing_fields_are_field_errors(self):
        # The fields refuse blanks before any credentials check
        cases = {
            "nothing": ({}, {"email": ["This field is required."], "password": ["This field is required."]}),
            "blank email": ({"email": "  ", "password": PASSWORD}, {"email": ["This field may not be blank."]}),
        }
        for label, (body, errors) in cases.items():
            with self.subTest(case=label):
                response = self.post(LOGIN, body)

                self.assertEqual((response.status_code, response.json()), (400, errors))

    def test_a_stale_bearer_header_is_ignored(self):
        # SimpleJWT's token views set authentication_classes = (), unlike register and reset
        response = self.login("pia@example.com", HTTP_AUTHORIZATION="Bearer garbage")

        self.assertEqual(response.status_code, 200)

    def test_signing_in_records_no_last_login(self):
        # UPDATE_LAST_LOGIN is off and the view never calls login(), so a reset link (whose hash includes
        # last_login) stays valid after the user signs in
        self.sign_in()

        self.pia.refresh_from_db()
        self.assertIsNone(self.pia.last_login)
