"""Sessions: a per-user session key carried in every token (SEC-05, BUG-140; decision 4).

`UserAccount.session_key` is a random UUID, and each token pair carries it as the `sk` claim. The authentication class
and the refresh serializer load the user and the account in one query and refuse a token whose key is missing or is
no longer the user's. A password reset, a password change and "sign out everywhere else" give the user a new key, which
ends every session at once (the device that asked gets a fresh pair); a plain sign-in or sign-out ends none. A random
key never matches after a database wipe, so an old token can't sign in as whoever gets its user id next (BUG-140), and
tokens issued before the key existed have no `sk`, so everyone signs in again once (AUTH-TWEAK-04).

Refresh tokens rotate (`ROTATE_REFRESH_TOKENS`): each refresh answers a new 30-day refresh token, so only 30 idle days
end a session (AUTH-TWEAK-03). There's no blacklist, so two tabs refreshing with one token both succeed.
"""

import uuid
from typing import Any

from django.contrib.auth import get_user_model
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken, Token

from ..models import UserAccount

SESSION_KEY_CLAIM = "sk"
SESSION_ENDED = "Your session has ended. Please sign in again."


def _loaded_account(user: Any) -> UserAccount | None:
    """The account loaded along with the user (select_related, or set when created), without a query; None when it
    wasn't loaded or doesn't exist."""
    if not type(user).account.is_cached(user):
        return None
    try:
        account: UserAccount = user.account
    except UserAccount.DoesNotExist:
        return None
    return account


def account_of(user: Any) -> UserAccount:
    """The user's account, created for a user made outside sign-up (createsuperuser, the seeders)."""
    try:
        account: UserAccount = user.account
    except UserAccount.DoesNotExist:
        account = UserAccount.objects.create(user=user)
    return account


def issue_tokens(user: Any) -> dict[str, str]:
    """A new `{access, refresh}` pair for this device, carrying the user's current session key."""
    refresh = RefreshToken.for_user(user)
    refresh[SESSION_KEY_CLAIM] = str(account_of(user).session_key)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}  # type: ignore[attr-defined]


def end_all_sessions(user: Any) -> None:
    """Give the user a new session key, so every token issued so far is refused (1 query); pairs issued afterwards
    carry the new key."""
    key = uuid.uuid4()
    UserAccount.objects.filter(user_id=user.pk).update(session_key=key)
    account = _loaded_account(user)
    if account is not None:
        account.session_key = key


def user_for_token(token: Token) -> Any:
    """The active user whose current session key `token` carries, with the account, in one query; else a 401."""
    try:
        user_id = token[api_settings.USER_ID_CLAIM]
    except KeyError:
        raise InvalidToken("Token contained no recognizable user identification") from None
    user_model = get_user_model()
    user = user_model.objects.select_related("account").filter(**{api_settings.USER_ID_FIELD: user_id}).first()
    if user is None:
        raise AuthenticationFailed("User not found", code="user_not_found")
    if not user.is_active:
        raise AuthenticationFailed("User is inactive", code="user_inactive")
    account = _loaded_account(user)
    if account is None or token.get(SESSION_KEY_CLAIM) != str(account.session_key):
        raise AuthenticationFailed(SESSION_ENDED, code="session_ended")
    return user


class SessionKeyJWTAuthentication(JWTAuthentication):
    """SimpleJWT's bearer authentication, refusing a token from an ended session; still one query a request."""

    def get_user(self, validated_token: Token) -> Any:
        return user_for_token(validated_token)


class SessionTokenRefreshSerializer(TokenRefreshSerializer):
    """SimpleJWT's refresh, after the same check as every request (1 query): it used to mint access tokens for any
    user id, inactive and deleted users included. Answers `{access, refresh}`, the refresh token rotated."""

    def validate(self, attrs: dict[str, Any]) -> dict[str, str]:
        user_for_token(self.token_class(attrs["refresh"]))
        return super().validate(attrs)
