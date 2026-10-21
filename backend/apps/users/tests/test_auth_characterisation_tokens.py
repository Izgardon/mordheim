"""Refresh, `/auth/me` and how long a session lives (pass 6; AUTH-TEST-07, -08, -13, SEC-05, BUG-140).

SimpleJWT 5.3.1 with the lifetimes set and refresh tokens rotating, with no blacklist. Characterisation found the user
loaded by `user_id` alone on each request and never on a refresh. PR A added a per-user session key
(`users.UserAccount`, claim `sk`) that the auth class and the refresh serializer check, so a reset, a password change
or "sign out everywhere else" ends every session (`test_sessions.py` covers the rest).
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.settings import api_settings

from apps.users.models import UserAccount

from .auth_support import (
    ME,
    NEW_PASSWORD,
    REFRESH,
    RESET_CONFIRM,
    AuthTestCase,
    access_claims,
    expired_access,
    expired_refresh,
    make_user,
    refresh_claims,
    reset_link_parts,
)

TOKEN_NOT_VALID = "token_not_valid"
SESSION_ENDED = {"detail": "Your session has ended. Please sign in again.", "code": "session_ended"}
NOT_PROVIDED = "Authentication credentials were not provided."


class RefreshTests(AuthTestCase):
    def test_a_refresh_answers_a_new_access_token_and_a_new_30_day_refresh_token(self):
        # AUTH-TWEAK-03, AUTH-TEST-07 (was pinned: only a new access token; flipped in PR A: the refresh token rotates,
        # so only 30 idle days end a session)
        tokens = self.sign_in()

        response = self.refresh(tokens["refresh"])

        self.assertEqual((response.status_code, sorted(response.json())), (200, ["access", "refresh"]))
        access, refresh = response.json()["access"], response.json()["refresh"]
        self.assertNotEqual(access_claims(access)["jti"], access_claims(tokens["access"])["jti"])
        old, new = refresh_claims(tokens["refresh"]), refresh_claims(refresh)
        self.assertNotEqual(new["jti"], old["jti"])
        self.assertEqual((new["user_id"], new["sk"]), (old["user_id"], old["sk"]))
        self.assertEqual(new["exp"] - new["iat"], 30 * 24 * 60 * 60)
        self.assertEqual(self.me(access).json()["id"], self.pia.id)
        self.assertEqual(self.refresh(refresh).status_code, 200)

    def test_one_refresh_token_can_be_used_again_and_again(self):
        # No blacklist (PR A adds none, though refresh tokens rotate): two tabs refreshing together both succeed
        tokens = self.sign_in()

        statuses = [self.refresh(tokens["refresh"]).status_code for _ in range(3)]

        self.assertEqual(statuses, [200, 200, 200])

    def test_an_expired_garbage_or_access_token_is_refused(self):
        # AUTH-TEST-07
        cases = {
            "expired": (expired_refresh(self.pia), "Token is invalid or expired"),
            "garbage": ("garbage", "Token is invalid or expired"),
            "an access token": (self.sign_in()["access"], "Token has wrong type"),
        }
        for label, (token, detail) in cases.items():
            with self.subTest(token=label):
                response = self.refresh(token)

                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.json(), {"detail": detail, "code": TOKEN_NOT_VALID})

    def test_a_refresh_without_a_token_is_a_field_error(self):
        response = self.post(REFRESH, {})

        self.assertEqual((response.status_code, response.json()), (400, {"refresh": ["This field is required."]}))


class MeTests(AuthTestCase):
    def test_me_with_a_real_access_token_answers_id_email_and_name(self):
        # AUTH-TEST-08
        response = self.me(self.sign_in()["access"])

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"id": self.pia.id, "email": "pia@example.com", "name": "Pia"})

    def test_me_refuses_a_missing_expired_garbage_or_refresh_token(self):
        # AUTH-TEST-08
        refresh = self.sign_in()["refresh"]
        cases = {
            "missing": (None, NOT_PROVIDED),
            "another scheme": ("Token abc", NOT_PROVIDED),  # not a Bearer header: no credentials
            "expired": (f"Bearer {expired_access(self.pia)}", TOKEN_NOT_VALID),
            "garbage": ("Bearer garbage", TOKEN_NOT_VALID),
            "a refresh token": (f"Bearer {refresh}", TOKEN_NOT_VALID),
            "three parts": ("Bearer a b", "bad_authorization_header"),
        }
        for label, (header, code) in cases.items():
            with self.subTest(header=label):
                response = self.client.get(ME, HTTP_AUTHORIZATION=header) if header else self.client.get(ME)

                body = response.json()  # DRF's own refusal has a detail and no code
                self.assertEqual((response.status_code, body.get("code", body["detail"])), (401, code))
                self.assertEqual(response["WWW-Authenticate"], 'Bearer realm="api"')

    def test_me_answers_only_get(self):
        # Characterises current behaviour (AUTH-NEW-02, decision 2, pinned; flips in PR A: PATCH changes the name)
        client = self.bearer(self.sign_in()["access"])
        for method in ("patch", "put", "post", "delete"):
            with self.subTest(method=method):
                response = getattr(client, method)(ME, {"name": "Pia the Bold"}, format="json")

                self.assertEqual(response.status_code, 405)
        self.pia.refresh_from_db()
        self.assertEqual(self.pia.first_name, "Pia")


class SessionLifetimeTests(AuthTestCase):
    def test_a_password_reset_ends_the_old_access_and_refresh_tokens(self):
        # SEC-05, AUTH-TEST-13 (was pinned: both kept working; flipped in PR A: a reset gives the user a new session
        # key, so both answer 401 session_ended)
        tokens = self.sign_in()
        key_before = UserAccount.objects.get(user=self.pia).session_key
        uid, token = reset_link_parts(self.pia)
        reset = self.post(RESET_CONFIRM, {"uid": uid, "token": token, "new_password": NEW_PASSWORD})
        self.assertEqual(reset.status_code, 200)

        for label, response in (("access", self.me(tokens["access"])), ("refresh", self.refresh(tokens["refresh"]))):
            with self.subTest(token=label):
                self.assertEqual((response.status_code, response.json()), (401, SESSION_ENDED))
        self.assertNotEqual(UserAccount.objects.get(user=self.pia).session_key, key_before)
        self.assertEqual(self.me(self.sign_in(password=NEW_PASSWORD)["access"]).status_code, 200)

    def test_a_password_set_by_an_admin_leaves_the_tokens_working(self):
        # Still pinned after PR A (SEC-05): `manage.py changepassword`, the admin route the brief names for email-off
        # production, is set_password and save, which doesn't touch the session key. Reset, the password change and
        # "sign out everywhere else" end sessions; see the PR A report's found-not-fixed
        tokens = self.sign_in()
        self.pia.set_password(NEW_PASSWORD)
        self.pia.save()

        self.assertEqual(self.me(tokens["access"]).status_code, 200)
        self.assertEqual(self.refresh(tokens["refresh"]).status_code, 200)

    def test_refresh_refuses_an_inactive_user(self):
        # SEC-05 (was pinned: refresh minted an access token that /me then refused; flipped in PR A: the refresh
        # loads the user and refuses)
        tokens = self.sign_in()
        get_user_model().objects.filter(id=self.pia.id).update(is_active=False)

        inactive = {"detail": "User is inactive", "code": "user_inactive"}
        for label, response in (("refresh", self.refresh(tokens["refresh"])), ("access", self.me(tokens["access"]))):
            with self.subTest(token=label):
                self.assertEqual((response.status_code, response.json()), (401, inactive))

    def test_refresh_refuses_a_deleted_user(self):
        # SEC-05 (was pinned: refresh minted an access token for a deleted user; flipped in PR A)
        rex = make_user("rex@example.com", "Rex")
        tokens = self.sign_in("rex@example.com")
        rex.delete()

        not_found = {"detail": "User not found", "code": "user_not_found"}
        for label, response in (("refresh", self.refresh(tokens["refresh"])), ("access", self.me(tokens["access"]))):
            with self.subTest(token=label):
                self.assertEqual((response.status_code, response.json()), (401, not_found))

    def test_a_token_for_a_deleted_user_does_not_sign_in_the_next_user_given_that_id(self):
        """/me answered 200 as the newcomer, and the old refresh token kept minting for him."""
        # BUG-140 (was an expected failure; fixed in PR A: a random session key never matches). A wiped and
        # reseeded database hands out the same ids again; with an unchanged DJANGO_SECRET_KEY, an old token checked
        # by user_id alone passed
        rex = make_user("rex@example.com", "Rex")
        tokens = self.sign_in("rex@example.com")
        rex_id = rex.id
        rex.delete()
        make_user("newcomer@example.com", "Newcomer", id=rex_id)

        for label, response in (("access", self.me(tokens["access"])), ("refresh", self.refresh(tokens["refresh"]))):
            with self.subTest(token=label):
                self.assertEqual((response.status_code, response.json()), (401, SESSION_ENDED))

    def test_signing_in_again_leaves_the_earlier_session_working(self):
        # Each device keeps its own pair; nothing ends another (PR A keeps this for a plain sign-in)
        first, second = self.sign_in(), self.sign_in()

        self.assertEqual((self.me(first["access"]).status_code, self.me(second["access"]).status_code), (200, 200))

    def test_sessions_end_by_session_key_not_by_blacklist(self):
        # SEC-05 (was pinned: no server-side sign-out at all; flipped in PR A: rotation on and the session key
        # checked; still no blacklist, and plain "Log out" stays this-device only, so there's no logout route)
        self.assertEqual(self.client.post("/api/auth/logout/").status_code, 404)
        self.assertNotIn("rest_framework_simplejwt.token_blacklist", settings.INSTALLED_APPS)
        self.assertEqual(sorted(settings.SIMPLE_JWT), ["ACCESS_TOKEN_LIFETIME", "REFRESH_TOKEN_LIFETIME", "ROTATE_REFRESH_TOKENS"])  # fmt: skip
        flags = (api_settings.ROTATE_REFRESH_TOKENS, api_settings.BLACKLIST_AFTER_ROTATION, api_settings.CHECK_REVOKE_TOKEN)  # fmt: skip
        self.assertEqual(flags, (True, False, False))
        self.assertEqual(settings.REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"], ("apps.users.services.tokens.SessionKeyJWTAuthentication",))  # fmt: skip
