import uuid

from django.conf import settings
from django.db import models


class UserAccount(models.Model):
    """What the app keeps about a user beside django.contrib.auth's User: the session key (SEC-05, BUG-140).

    Every token carries the key as its `sk` claim, and a token whose key isn't the user's current one is refused
    (`apps.users.services.tokens`). A new key ends every session at once. Created at sign-up, or at the first sign-in
    of a user made another way (createsuperuser, the seeders).
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, primary_key=True, related_name="account"
    )
    session_key = models.UUIDField(default=uuid.uuid4)

    class Meta:
        db_table = "user_account"

    def __str__(self) -> str:
        return f"account of user {self.user_id}"


class SocialIdentity(models.Model):
    """One provider account linked to one of ours: a row, not a column, so a user may hold several (Google and
    Discord, and Apple later) and a provider account can only ever name one user.

    The key is `(provider, subject)`: the provider's own stable id for the person, never the email, which can change
    hands. `email` is only what the provider last asserted, kept for support; `email_verified` says whether it may be
    matched against an account at all (`apps.users.services.sso_accounts`).
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="social_identities", db_index=True
    )
    provider = models.CharField(max_length=20)
    subject = models.CharField(max_length=255)
    email = models.CharField(max_length=254, blank=True, default="")
    email_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    last_login_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_social_identity"
        constraints = [models.UniqueConstraint(fields=["provider", "subject"], name="social_identity_unique_subject")]

    def __str__(self) -> str:
        return f"{self.provider} identity of user {self.user_id}"


class SsoLoginAttempt(models.Model):
    """One sign-in attempt in flight: the `state` the provider echoes back, the PKCE verifier it must be redeemed
    with, and the redirect URI it was authorized for.

    `browser_hash` is the SHA-256 of a secret handed to the browser that started the attempt and kept in its
    sessionStorage, so a `state` lifted from a redirect URL is useless anywhere else. `consumed_at` makes an attempt
    single-use, and a row older than `ATTEMPT_TTL` is dead whatever it holds.
    """

    provider = models.CharField(max_length=20)
    state = models.CharField(max_length=128, unique=True)
    code_verifier = models.CharField(max_length=128)
    browser_hash = models.CharField(max_length=64)
    redirect_uri = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "user_sso_login_attempt"

    def __str__(self) -> str:
        return f"{self.provider} sign-in attempt {self.pk}"
