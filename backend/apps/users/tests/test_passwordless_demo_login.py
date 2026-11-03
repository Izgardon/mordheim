"""TEMPORARY (William, 3 Nov 2026: "temporarily disable password protection and input, you just sign in with an
email"): a demo account (@mordheim.test) signs in with its email alone; every other account still needs its password.
Revert the commit that added this file to restore password sign-in for everyone."""

from typing import Any

from .auth_support import LOGIN, PASSWORD, AuthTestCase, make_user

INVALID = {"non_field_errors": ["Invalid credentials"]}


class PasswordlessDemoLoginTests(AuthTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.captain = make_user("captain@mordheim.test", "Cap")

    def login(self, body: dict[str, Any]) -> Any:
        return self.post(LOGIN, body)

    def test_a_demo_account_signs_in_with_its_email_alone(self):
        for body in ({"email": "Captain@Mordheim.test"}, {"email": "captain@mordheim.test", "password": ""}):
            with self.subTest(body=body):
                response = self.login(body)

                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["user"]["id"], self.captain.id)

    def test_a_demo_account_s_wrong_password_is_still_refused(self):
        response = self.login({"email": "captain@mordheim.test", "password": "not-it"})

        self.assertEqual((response.status_code, response.json()), (400, INVALID))

    def test_every_other_account_still_needs_its_password(self):
        without = self.login({"email": "pia@example.com"})
        right = self.login({"email": "pia@example.com", "password": PASSWORD})

        self.assertEqual((without.status_code, without.json()), (400, INVALID))
        self.assertEqual(right.status_code, 200)

    def test_an_unknown_or_inactive_demo_email_is_refused(self):
        make_user("gone@mordheim.test", is_active=False)

        for email in ("nobody@mordheim.test", "gone@mordheim.test"):
            with self.subTest(email=email):
                self.assertEqual(self.login({"email": email}).json(), INVALID)
