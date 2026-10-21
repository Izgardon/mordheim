"""Sign-up today (pass 6; AUTH-TEST-01 to -04, BUG-84, AUTH-CQ-04, SEC-11, decision 2).

`POST auth/register/` lowercases the email into `username` and `email`, stores the optional name in `first_name`,
and answers 201 with a token pair and the user. PR A bounds the name (1-40 characters, required) and the email
(150), turns the duplicate insert into a 400, and validates the password against the new user.
"""

from typing import Any

from django.contrib.auth import get_user_model
from django.test import override_settings

from .auth_support import PASSWORD, REGISTER, AuthTestCase


def email_of_length(length: int) -> str:
    """A valid address of exactly `length` characters (a 64-character local part, labels of up to 63)."""
    local = "a" * 64
    remaining = length - len(local) - 1 - len(".com")  # "@" and the top-level domain
    first = min(remaining, 63)
    labels = ["b" * first] if remaining == first else ["b" * 40, "c" * (remaining - 41)]
    return f"{local}@{'.'.join(labels)}.com"


class RegisterTests(AuthTestCase):
    def register(self, **body: str) -> Any:
        return self.post(REGISTER, {"password": PASSWORD, **body})

    def test_a_sign_up_answers_201_with_a_token_pair_and_the_user(self):
        # AUTH-TEST-01: the email is trimmed and lowercased into username and email; the name is first_name
        response = self.register(email="  Rex@Example.COM ", name="Rex")

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(sorted(body), ["access", "refresh", "user"])
        user = get_user_model().objects.get(username="rex@example.com")
        self.assertEqual(body["user"], {"id": user.id, "email": "rex@example.com", "name": "Rex"})
        self.assertEqual((user.email, user.first_name, user.is_active), ("rex@example.com", "Rex", True))
        self.assertTrue(user.check_password(PASSWORD))
        self.assertEqual(self.me(body["access"]).json(), body["user"])
        self.assertEqual(sorted(self.refresh(body["refresh"]).json()), ["access"])

    def test_a_taken_email_in_any_case_is_refused_and_says_so(self):
        # AUTH-TEST-02; SEC-11: "User already exists" stays (players need to know to sign in), accepted
        response = self.register(email="PIA@Example.com", name="Another Pia")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"email": ["User already exists"]})
        self.assertEqual(get_user_model().objects.filter(username="pia@example.com").count(), 1)

    def test_a_sign_up_without_a_name_succeeds_with_a_blank_name(self):
        # Characterises current behaviour (decision 2, AUTH-TWEAK-01, pinned; flips in PR A: the name is required)
        cases = {"omitted": {}, "blank": {"name": ""}, "spaces": {"name": "   "}}
        for label, name in cases.items():
            with self.subTest(name=label):
                response = self.register(email=f"{label}@example.com", **name)

                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.json()["user"]["name"], "")
                self.assertEqual(get_user_model().objects.get(username=f"{label}@example.com").first_name, "")

    def test_the_name_is_trimmed_and_not_unique(self):
        response = self.register(email="rex@example.com", name="  Pia  ")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["user"]["name"], "Pia")

    @override_settings(RATE_LIMIT_ENABLED=False)  # four refused sign-ups from one address
    def test_a_weak_password_is_refused_with_every_validator_message(self):
        # AUTH-TEST-03 (the part that holds today); "short" stops at the field's min_length
        cases = {
            "12345678": ["This password is too common.", "This password is entirely numeric."],
            "password": ["This password is too common."],
            "short": ["Ensure this field has at least 8 characters."],
            "": ["This field may not be blank."],
        }
        for password, messages in cases.items():
            with self.subTest(password=password):
                response = self.post(REGISTER, {"email": "weak@example.com", "password": password})

                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json(), {"password": messages})
        self.assertFalse(get_user_model().objects.filter(username="weak@example.com").exists())

    def test_a_password_equal_to_the_email_or_the_name_is_accepted(self):
        # Characterises current behaviour (AUTH-CQ-04 b, AUTH-TEST-03, pinned; flips in PR A): validate_password
        # runs without the user, so UserAttributeSimilarityValidator never compares it
        same_as_email = self.post(REGISTER, {"email": "lanternbearer@example.com", "password": "lanternbearer@example.com"})  # fmt: skip
        same_as_name = self.post(REGISTER, {"email": "rex@example.com", "password": "Lanternbearer", "name": "Lanternbearer"})  # fmt: skip

        self.assertEqual((same_as_email.status_code, same_as_name.status_code), (201, 201))

    @override_settings(RATE_LIMIT_ENABLED=False)
    def test_missing_or_malformed_fields_are_field_errors(self):
        cases = {
            "nothing": ({}, {"email": ["This field is required."], "password": ["This field is required."]}),
            "not an email": ({"email": "pia", "password": PASSWORD}, {"email": ["Enter a valid email address."]}),
        }
        for label, (body, errors) in cases.items():
            with self.subTest(case=label):
                response = self.post(REGISTER, body)

                self.assertEqual((response.status_code, response.json()), (400, errors))

    def test_an_email_of_150_characters_and_a_name_of_40_fit(self):
        # BUG-84 (was: a 150-character name fit; PR A bounds the name at 40)
        email = email_of_length(150)
        self.assertEqual(len(email), 150)

        response = self.register(email=email, name="N" * 40)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(get_user_model().objects.get(username=email).first_name, "N" * 40)

    def test_an_email_of_151_characters_is_a_field_error(self):
        """The address passed EmailField and the insert into username (varchar 150) was a 500."""
        # BUG-84, AUTH-TEST-04 (was an expected failure; fixed in PR A: email max_length 150)
        self.answer_errors_with_500()
        email = email_of_length(151)
        self.assertEqual(len(email), 151)

        response = self.register(email=email, name="Rex")

        self.assertEqual((response.status_code, response.json()), (400, {"email": ["Ensure this field has no more than 150 characters."]}))  # fmt: skip
        self.assertFalse(get_user_model().objects.filter(username=email).exists())

    def test_a_name_over_40_characters_is_a_field_error(self):
        """`name` had no max_length, and a 151-character one was a 500 at the insert into first_name (varchar 150)."""
        # BUG-84, AUTH-TEST-04 (was an expected failure at 151; fixed in PR A: names of 1-40 characters)
        self.answer_errors_with_500()
        for length in (41, 151):
            with self.subTest(length=length):
                response = self.register(email=f"rex{length}@example.com", name="N" * length)

                self.assertEqual((response.status_code, response.json()), (400, {"name": ["Ensure this field has no more than 40 characters."]}))  # fmt: skip
        self.assertFalse(get_user_model().objects.filter(username__startswith="rex").exists())

    def test_a_stale_bearer_header_makes_a_sign_up_401(self):
        # Register runs the default JWT authentication although it allows anyone; the SPA sends no token here
        # (auth-api passes token: null), so only a hand-made request meets this
        response = self.post(REGISTER, {"email": "rex@example.com", "password": PASSWORD}, HTTP_AUTHORIZATION="Bearer garbage")  # fmt: skip

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], "token_not_valid")
        self.assertFalse(get_user_model().objects.filter(username="rex@example.com").exists())
