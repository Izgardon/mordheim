"""The session key (pass 6 PR A; SEC-05, BUG-140, AUTH-TWEAK-04).

Each user's `UserAccount` holds a random session key that every token pair carries as `sk`. A token without it (issued
before PR A) or with another key is refused with 401 `session_ended`, on requests and on refresh alike, in the one
query that loads the user. `test_auth_characterisation_tokens.py` keeps the flipped pins (reset, inactive and deleted
users, BUG-140).
"""

import uuid
from typing import Any

from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import UserAccount

from .auth_support import LOGIN, PASSWORD, REGISTER, AuthTestCase, access_claims, make_user, refresh_claims

SESSION_ENDED = {"detail": "Your session has ended. Please sign in again.", "code": "session_ended"}


def pair(user: Any, **claims: str) -> dict[str, str]:
    """A correctly signed pair for `user` with these extra claims (none: a token from before PR A)."""
    refresh = RefreshToken.for_user(user)
    for name, value in claims.items():
        refresh[name] = value
    return {"access": str(refresh.access_token), "refresh": str(refresh)}  # type: ignore[attr-defined]


class SessionKeyTests(AuthTestCase):
    def assert_session_ended(self, tokens: dict[str, str]) -> None:
        for label, response in (("access", self.me(tokens["access"])), ("refresh", self.refresh(tokens["refresh"]))):
            with self.subTest(token=label):
                self.assertEqual((response.status_code, response.json()), (401, SESSION_ENDED))

    def test_a_token_from_before_session_keys_is_refused(self):
        # AUTH-TWEAK-04: tokens issued before PR A carry no `sk`, so everyone signs in again once
        self.assert_session_ended(pair(self.pia))

    def test_a_token_carrying_another_key_is_refused(self):
        self.assert_session_ended(pair(self.pia, sk=str(uuid.uuid4())))

    def test_the_refusal_costs_the_one_user_query_and_names_the_bearer_scheme(self):
        client = self.bearer(pair(self.pia)["access"])

        with self.assertNumQueries(1):
            response = client.get("/api/auth/me/")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response["WWW-Authenticate"], 'Bearer realm="api"')

    def test_sign_up_gives_each_account_its_own_random_key_and_the_pair_carries_it(self):
        keys = []
        for name in ("Rex", "Ina"):
            body = self.post(REGISTER, {"email": f"{name.lower()}@example.com", "password": PASSWORD, "name": name}).json()  # fmt: skip
            account = UserAccount.objects.get(user_id=body["user"]["id"])
            self.assertEqual(access_claims(body["access"])["sk"], str(account.session_key))
            self.assertEqual(refresh_claims(body["refresh"])["sk"], str(account.session_key))
            keys.append(account.session_key)

        self.assertNotEqual(keys[0], keys[1])

    def test_a_user_made_outside_sign_up_gets_an_account_at_the_first_sign_in(self):
        # createsuperuser and the seeders make users without an account: the first sign-in adds it (one INSERT)
        make_user("ina@example.com", "Ina", account=False)
        login = {"email": "ina@example.com", "password": PASSWORD}

        with self.assertNumQueries(3):  # the user, the account's INSERT, last_login's UPDATE
            first = self.post(LOGIN, login)
        with self.assertNumQueries(2):
            second = self.post(LOGIN, login)

        account = UserAccount.objects.get(user__username="ina@example.com")
        for response in (first, second):
            self.assertEqual(response.status_code, 200)
            self.assertEqual(access_claims(response.json()["access"])["sk"], str(account.session_key))
        self.assertEqual(self.me(first.json()["access"]).status_code, 200)

    def test_a_user_without_an_account_is_refused_until_they_sign_in(self):
        ina = make_user("ina@example.com", "Ina", account=False)

        self.assert_session_ended(pair(ina, sk=str(uuid.uuid4())))

    def test_deleting_a_user_deletes_their_account(self):
        rex = make_user("rex@example.com", "Rex")

        get_user_model().objects.filter(id=rex.id).delete()

        self.assertFalse(UserAccount.objects.filter(user_id=rex.id).exists())
