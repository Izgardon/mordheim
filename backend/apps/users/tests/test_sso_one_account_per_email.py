"""One account per email address, and which direction may combine (William, 19 Nov 2026).

"Lets combine if someone's account is the same email as their Google or discord": a provider asserting a **verified**
email proves the person controls it, so SSO onto an existing password account links (test_sso_accounts.py).

The reverse must not. Typing an address into the register form proves nothing, so registration may never attach
itself to an account made through a provider — anyone who knew the address would take it over. It refuses instead,
and names the provider so the person can get in.

"Forgot password route is only for people that create an account without sso": an SSO-only account has an opaque
`sso-<hex>` username, so a reset request for its address finds nobody. That is pinned here on purpose rather than
left true by accident.
"""

from typing import Any
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import override_settings

from apps.users.models import SocialIdentity, UserAccount
from apps.users.serializers import EMAIL_TAKEN

from .auth_support import PASSWORD, REGISTER, RESET, make_user
from .sso_support import SsoTestCase, profile

SIGN_IN_WITH_GOOGLE = "You already have an account. Sign in with Google."
SIGN_IN_WITH_EITHER = "You already have an account. Sign in with Google or Discord."
RESET_SENT = "If an account exists for that email, a reset link has been sent."


class RegisteringOverAnSsoAccountTests(SsoTestCase):
    def register(self, email: str) -> Any:
        return self.post(REGISTER, {"name": "Nell", "email": email, "password": "lantern-of-ulric"})

    def test_an_address_held_by_an_sso_only_account_is_refused_and_names_the_provider(self):
        self.sign_in_with(profile(subject="g-1", email="nell@example.com", name="Nell"))

        response = self.register("nell@example.com")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"email": [SIGN_IN_WITH_GOOGLE]})
        # And no second account was made for the address.
        self.assertEqual(get_user_model().objects.filter(email__iexact="nell@example.com").count(), 1)

    def test_the_refusal_names_every_provider_the_account_can_sign_in_with(self):
        self.sign_in_with(profile(subject="g-2", email="nell@example.com"))
        self.sign_in_with(profile(subject="d-2", email="nell@example.com"), "discord")

        response = self.register("nell@example.com")

        self.assertEqual(response.json(), {"email": [SIGN_IN_WITH_EITHER]})

    def test_letter_case_does_not_get_a_second_account_either(self):
        self.sign_in_with(profile(subject="g-3", email="nell@example.com"))

        response = self.register("Nell@Example.COM")

        self.assertEqual(response.json(), {"email": [SIGN_IN_WITH_GOOGLE]})

    def test_an_address_held_by_a_password_account_keeps_the_old_wording(self):
        response = self.register("pia@example.com")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"email": [EMAIL_TAKEN]})

    def test_a_password_account_that_later_linked_google_keeps_the_old_wording(self):
        # He has a password, so "sign in with Google" would be the wrong advice: either way in works.
        self.sign_in_with(profile(subject="g-4", email="pia@example.com"))

        response = self.register("pia@example.com")

        self.assertEqual(response.json(), {"email": [EMAIL_TAKEN]})

    def test_both_refusals_are_the_same_400_on_the_same_field(self):
        self.sign_in_with(profile(subject="g-5", email="nell@example.com"))

        sso_held = self.register("nell@example.com")
        password_held = self.register("pia@example.com")

        self.assertEqual(sso_held.status_code, password_held.status_code)
        self.assertEqual(list(sso_held.json()), list(password_held.json()))

    def test_an_unverified_sso_accounts_blank_address_blocks_nobody(self):
        # It keeps no address on the user by design, so the address is still free to register with.
        self.sign_in_with(profile(subject="g-6", email="nell@example.com", email_verified=False))

        response = self.register("nell@example.com")

        self.assertEqual(response.status_code, 201)

    def test_a_deleted_accounts_address_is_free_to_register_again(self):
        from apps.users.services import deletion

        gone = make_user("gone@example.com", "Gone")
        deletion.delete_account(gone)

        response = self.register("gone@example.com")

        self.assertEqual(response.status_code, 201)

    def test_a_race_that_slips_past_the_check_is_refused_in_the_providers_words(self):
        """BUG-84's catch, now wording the refusal the same way: the database has the last say."""
        self.sign_in_with(profile(subject="g-7", email="nell@example.com"))

        with patch("apps.users.serializers.account_for_email", side_effect=[None, _held_account()]):
            response = self.register("nell@example.com")

        self.assertEqual((response.status_code, response.json()), (400, {"email": [SIGN_IN_WITH_GOOGLE]}))


def _held_account():
    """The account the second lookup finds: the SSO one made by the test above."""
    return get_user_model().objects.get(email="nell@example.com")


class OneActiveAccountPerEmailIndexTests(SsoTestCase):
    """The index itself (`users/0003`), which is what holds under a race."""

    def test_a_second_active_account_with_the_same_address_is_refused(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                get_user_model().objects.create(username="other", email="pia@example.com")

    def test_the_same_address_in_another_case_is_refused_too(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                get_user_model().objects.create(username="other", email="Pia@Example.COM")

    def test_accounts_keeping_no_address_do_not_collide(self):
        first = get_user_model().objects.create(username="sso-aaaa", email="")
        second = get_user_model().objects.create(username="sso-bbbb", email="")

        self.assertNotEqual(first.pk, second.pk)

    def test_an_inactive_account_neither_collides_nor_blocks_the_address(self):
        get_user_model().objects.create(username="retired", email="pia@example.com", is_active=False)

        still_there = get_user_model().objects.filter(email__iexact="pia@example.com").count()

        self.assertEqual(still_there, 2)


@override_settings(RESEND_API_KEY="re_not_a_real_key", FRONTEND_URL="https://mordheim.example.org")
class ResetIsForPasswordAccountsOnlyTests(SsoTestCase):
    """William, 19 Nov 2026: "Forgot password route is only for people that create an account without sso"."""

    def test_a_reset_for_an_sso_only_accounts_address_sends_nothing_and_says_what_it_always_says(self):
        self.sign_in_with(profile(subject="g-8", email="nell@example.com", name="Nell"))

        with patch("apps.users.views.send_password_reset_email") as send:
            response = self.post(RESET, {"email": "nell@example.com"})

        self.assertEqual((response.status_code, response.json()), (200, {"detail": RESET_SENT}))
        send.assert_not_called()

    def test_it_answers_exactly_as_it_does_for_an_address_nobody_holds(self):
        self.sign_in_with(profile(subject="g-9", email="nell@example.com"))

        with patch("apps.users.views.send_password_reset_email"):
            held = self.post(RESET, {"email": "nell@example.com"})
            unknown = self.post(RESET, {"email": "nobody@example.com"})

        self.assertEqual((held.status_code, held.json()), (unknown.status_code, unknown.json()))

    def test_a_password_account_that_linked_google_can_still_reset(self):
        self.sign_in_with(profile(subject="g-10", email="pia@example.com"))

        with patch("apps.users.views.send_password_reset_email") as send:
            response = self.post(RESET, {"email": "pia@example.com"})

        self.assertEqual(response.status_code, 200)
        send.assert_called_once()
        self.assertEqual(send.call_args.args[0], "pia@example.com")

    def test_an_sso_only_account_has_no_password_to_sign_in_with(self):
        self.sign_in_with(profile(subject="g-11", email="nell@example.com"))
        user = get_user_model().objects.get(email="nell@example.com")

        self.assertFalse(user.has_usable_password())
        refused = self.post("/api/auth/login/", {"email": "nell@example.com", "password": PASSWORD})
        self.assertEqual(refused.status_code, 400)


class SharedAccountShapeTests(SsoTestCase):
    """The pieces registration's refusal reads."""

    def test_an_account_with_no_identity_names_no_provider(self):
        from apps.users.services.sso_accounts import linked_provider_labels

        self.assertEqual(linked_provider_labels(self.pia), [])

    def test_the_labels_come_in_the_registrys_order_however_they_were_linked(self):
        from apps.users.services.sso_accounts import linked_provider_labels

        user = make_user("both@example.com", "Both", password=None)
        UserAccount.objects.filter(user=user).delete()
        SocialIdentity.objects.create(user=user, provider="discord", subject="d-x")
        SocialIdentity.objects.create(user=user, provider="google", subject="g-x")

        self.assertEqual(linked_provider_labels(user), ["Google", "Discord"])
