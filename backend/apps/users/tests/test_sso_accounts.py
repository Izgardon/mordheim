"""Which account a social sign-in reaches, and the session it gets.

The cases that matter: a brand-new user; an existing password account linked by a verified email; a provider that
doesn't assert a verified email (a new account, never a link); a deleted (inactive) account, which SSO must never
match or resurrect; and that "sign out other sessions" ends an SSO session, because its tokens are minted by the
password path.
"""

from django.contrib.auth import get_user_model

from apps.users.models import SocialIdentity
from apps.users.names import FORMER_PLAYER
from apps.users.services import deletion

from .auth_support import PASSWORD, make_user
from .sso_support import SsoTestCase, profile


class NewAccountTests(SsoTestCase):
    def test_a_brand_new_user_gets_an_account_a_session_and_an_identity(self):
        response = self.sign_in_with(profile(subject="g-1", email="nell@example.com", name="Nell"))

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["user"], {"id": body["user"]["id"], "email": "nell@example.com", "name": "Nell"})
        user = get_user_model().objects.get(pk=body["user"]["id"])
        self.assertFalse(user.has_usable_password())
        self.assertTrue(user.is_active)
        identity = SocialIdentity.objects.get(user=user)
        self.assertEqual((identity.provider, identity.subject, identity.email_verified), ("google", "g-1", True))
        # The pair works at once, as sign-in's does.
        self.assertEqual(self.me(body["access"]).status_code, 200)

    def test_the_username_is_opaque_and_holds_no_part_of_the_email(self):
        response = self.sign_in_with(profile(subject="g-2", email="nell.smith@example.com", name="Nell"))

        user = get_user_model().objects.get(pk=response.json()["user"]["id"])
        self.assertTrue(user.username.startswith("sso-"))
        for leak in ("nell.smith", "nell", "example.com", "@"):
            self.assertNotIn(leak, user.username)

    def test_a_second_sign_in_reuses_the_account_rather_than_making_another(self):
        first = self.sign_in_with(profile(subject="g-3", email="nell@example.com"))
        self.assertEqual(first.status_code, 201)

        second = self.sign_in_with(profile(subject="g-3", email="nell@example.com"))

        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.json()["user"]["id"], first.json()["user"]["id"])
        self.assertEqual(SocialIdentity.objects.filter(subject="g-3").count(), 1)

    def test_a_long_provider_name_is_trimmed_to_a_display_name(self):
        response = self.sign_in_with(profile(subject="g-4", email="long@example.com", name="N" * 80))

        self.assertEqual(len(response.json()["user"]["name"]), 40)


class LinkingTests(SsoTestCase):
    def test_a_verified_email_links_to_the_existing_password_account(self):
        response = self.sign_in_with(profile(subject="g-5", email="pia@example.com", name="Pia from Google"))

        self.assertEqual(response.status_code, 200)  # not 201: no account was made
        self.assertEqual(response.json()["user"]["id"], self.pia.id)
        self.assertEqual(SocialIdentity.objects.get(subject="g-5").user_id, self.pia.id)
        # The account keeps its own display name; the provider doesn't rename it.
        self.pia.refresh_from_db()
        self.assertEqual(self.pia.first_name, "Pia")
        # And the password still signs in.
        self.assertEqual(self.me(self.sign_in()["access"]).status_code, 200)

    def test_an_unverified_email_never_links_and_makes_its_own_account(self):
        response = self.sign_in_with(
            profile(subject="g-6", email="pia@example.com", email_verified=False, name="Not Pia")
        )

        self.assertEqual(response.status_code, 201)
        self.assertNotEqual(response.json()["user"]["id"], self.pia.id)
        user = get_user_model().objects.get(pk=response.json()["user"]["id"])
        # The address we can't trust is kept for support, never on the user, where a reset would trust it.
        self.assertEqual(user.email, "")
        identity = SocialIdentity.objects.get(subject="g-6")
        self.assertEqual((identity.email, identity.email_verified), ("pia@example.com", False))

    def test_a_verified_email_matching_an_sso_account_links_rather_than_duplicating(self):
        first = self.sign_in_with(profile(subject="g-7", email="nell@example.com"))

        linked = self.sign_in_with(profile(subject="d-7", email="nell@example.com"), "discord")

        self.assertEqual(linked.status_code, 200)
        self.assertEqual(linked.json()["user"]["id"], first.json()["user"]["id"])
        self.assertEqual(
            sorted(
                SocialIdentity.objects.filter(user_id=first.json()["user"]["id"]).values_list("provider", flat=True)
            ),
            ["discord", "google"],
        )

    def test_both_providers_on_one_account_each_keep_their_own_row(self):
        self.sign_in_with(profile(subject="g-8", email="pia@example.com"))
        self.sign_in_with(profile(subject="d-8", email="pia@example.com"), "discord")

        rows = SocialIdentity.objects.filter(user_id=self.pia.id)
        self.assertEqual(rows.count(), 2)
        self.assertEqual(rows.filter(provider="google", subject="g-8").count(), 1)

    def test_the_identitys_stored_email_follows_the_provider(self):
        self.sign_in_with(profile(subject="g-9", email="old@example.com"))

        self.sign_in_with(profile(subject="g-9", email="new@example.com"))

        self.assertEqual(SocialIdentity.objects.get(subject="g-9").email, "new@example.com")


class DeletedAccountTests(SsoTestCase):
    def test_a_deleted_accounts_address_is_not_matched_or_resurrected(self):
        gone = make_user("gone@example.com", "Gone")
        deletion.delete_account(gone)
        gone.refresh_from_db()
        self.assertFalse(gone.is_active)

        response = self.sign_in_with(profile(subject="g-10", email="gone@example.com", name="Gone"))

        self.assertEqual(response.status_code, 201)
        self.assertNotEqual(response.json()["user"]["id"], gone.id)
        gone.refresh_from_db()
        self.assertFalse(gone.is_active)
        self.assertEqual(gone.first_name, FORMER_PLAYER)

    def test_deleting_an_account_unlinks_its_providers(self):
        self.sign_in_with(profile(subject="g-11", email="pia@example.com"))
        self.assertTrue(SocialIdentity.objects.filter(user_id=self.pia.id).exists())

        deletion.delete_account(self.pia)

        self.assertFalse(SocialIdentity.objects.filter(user_id=self.pia.id).exists())

    def test_an_identity_left_on_an_inactive_user_is_refused_not_signed_in(self):
        self.sign_in_with(profile(subject="g-12", email="pia@example.com"))
        get_user_model().objects.filter(pk=self.pia.id).update(is_active=False)

        response = self.sign_in_with(profile(subject="g-12", email="pia@example.com"))

        self.assertEqual((response.status_code, response.json()["code"]), (403, "sso_account_unavailable"))


class SsoSessionTests(SsoTestCase):
    def test_sign_out_others_ends_an_sso_session(self):
        tokens = self.sign_in_with(profile(subject="g-13", email="nell@example.com")).json()
        other_device = self.sign_in_with(profile(subject="g-13", email="nell@example.com")).json()

        ended = self.bearer(other_device["access"]).post("/api/auth/sign-out-others/")

        self.assertEqual(ended.status_code, 200)
        refused = self.me(tokens["access"])
        self.assertEqual((refused.status_code, refused.json()["code"]), (401, "session_ended"))
        # The device that asked keeps playing on its fresh pair.
        self.assertEqual(self.me(ended.json()["access"]).status_code, 200)

    def test_a_password_change_on_a_linked_account_ends_its_sso_session(self):
        sso_tokens = self.sign_in_with(profile(subject="g-14", email="pia@example.com")).json()
        password_tokens = self.sign_in()

        changed = self.bearer(password_tokens["access"]).post(
            "/api/auth/password/",
            {"current_password": PASSWORD, "new_password": "brazier-of-the-comet"},
            format="json",
        )

        self.assertEqual(changed.status_code, 200)
        refused = self.me(sso_tokens["access"])
        self.assertEqual((refused.status_code, refused.json()["code"]), (401, "session_ended"))
