"""The API's rate limits: one table of scopes, each counting by address, by user or by email.

A scope's rate is `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"][scope]` in the settings, read on every request (so tests can
lower it and `RATE_LIMIT_ENABLED` turns every limit off). A view lists the scopes it counts against through the
`*_THROTTLE_CLASSES` lists below; adding a limit is a row here and a rate there.
"""

from __future__ import annotations

import hashlib
from typing import TYPE_CHECKING, cast

from django.conf import settings
from rest_framework.throttling import SimpleRateThrottle

if TYPE_CHECKING:
    from rest_framework.views import APIView

    _ViewBase = APIView
else:
    _ViewBase = object


class MethodScopedThrottleMixin(_ViewBase):
    throttled_methods = frozenset({"POST"})

    def get_throttles(self):
        if (self.request.method or "").upper() not in self.throttled_methods:
            return []
        return super().get_throttles()


class ToggleableScopedRateThrottle(SimpleRateThrottle):
    def get_rate(self):
        if not getattr(settings, "RATE_LIMIT_ENABLED", True):
            return None
        return settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {}).get(self.scope)

    def _cache_key(self, ident: str | None) -> str | None:
        if not ident:
            return None
        return self.cache_format % {"scope": self.scope, "ident": ident}


class IPRateThrottle(ToggleableScopedRateThrottle):
    def get_cache_key(self, request, view):
        return self._cache_key(self.get_ident(request))


class UserOrIPRateThrottle(ToggleableScopedRateThrottle):
    def get_cache_key(self, request, view):
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            return self._cache_key(f"user:{user.pk}")
        return self._cache_key(f"ip:{self.get_ident(request)}")


class EmailRateThrottle(ToggleableScopedRateThrottle):
    """Keyed on the email in the request body, trimmed and lowercased, so one account's limit holds whichever
    network the requests come from, while players sharing a table's address keep their own (BUG-55, SEC-04). The
    address is hashed into the key. A body without an email string isn't counted here."""

    def get_cache_key(self, request, view):
        data = request.data
        email = data.get("email") if hasattr(data, "get") else None
        if not isinstance(email, str) or not email.strip():
            return None
        digest = hashlib.sha256(email.strip().lower().encode()).hexdigest()
        return self._cache_key(f"email:{digest}")


# A throttle counts by address, by user (by address when anonymous), or by the email in the body
Throttle = IPRateThrottle | UserOrIPRateThrottle | EmailRateThrottle

# Every scope and whose requests share its count. The auth limits are loose per address, since a table of players
# shares one, and tight per email (BUG-55); the writes count per user, with a looser per-address backstop.
SCOPES: dict[str, type[Throttle]] = {
    "auth_login_minute": IPRateThrottle,
    "auth_login_email_minute": EmailRateThrottle,
    "auth_login_email_hour": EmailRateThrottle,
    "auth_register_hour": IPRateThrottle,
    "auth_register_day": IPRateThrottle,
    "auth_password_reset_hour": IPRateThrottle,
    "auth_password_reset_email_hour": EmailRateThrottle,
    "auth_password_reset_confirm_hour": IPRateThrottle,
    "auth_refresh_minute": IPRateThrottle,
    "auth_account_user": UserOrIPRateThrottle,
    "feedback_report_user": UserOrIPRateThrottle,
    "feedback_report_ip": IPRateThrottle,
    "campaign_chat_user": UserOrIPRateThrottle,
    "campaign_chat_ip": IPRateThrottle,
    "battle_write_user": UserOrIPRateThrottle,
    "battle_write_ip": IPRateThrottle,
    "trade_write_user": UserOrIPRateThrottle,
    "trade_write_ip": IPRateThrottle,
}


def _throttle_class(scope: str) -> type[Throttle]:
    """The throttle for `scope`: its counting class with the scope set, named after both (`auth_login_minute` counted
    by address is `AuthLoginMinuteIPRateThrottle`)."""
    kind = SCOPES[scope]
    name = "".join(word.capitalize() for word in scope.split("_")) + kind.__name__
    return cast(type[Throttle], type(name, (kind,), {"scope": scope, "__module__": __name__}))


THROTTLES: dict[str, type[Throttle]] = {scope: _throttle_class(scope) for scope in SCOPES}


def throttle_classes(*scopes: str) -> list[type[Throttle]]:
    """A view's `throttle_classes`: the throttles for these scopes, in order."""
    return [THROTTLES[scope] for scope in scopes]


LOGIN_THROTTLE_CLASSES = throttle_classes("auth_login_minute", "auth_login_email_minute", "auth_login_email_hour")
REGISTER_THROTTLE_CLASSES = throttle_classes("auth_register_hour", "auth_register_day")
PASSWORD_RESET_REQUEST_THROTTLE_CLASSES = throttle_classes("auth_password_reset_hour", "auth_password_reset_email_hour")
PASSWORD_RESET_CONFIRM_THROTTLE_CLASSES = throttle_classes("auth_password_reset_confirm_hour")
REFRESH_THROTTLE_CLASSES = throttle_classes("auth_refresh_minute")
# The password change, "sign out everywhere else" and deleting the account share one budget per user
ACCOUNT_THROTTLE_CLASSES = throttle_classes("auth_account_user")
FEEDBACK_REPORT_THROTTLE_CLASSES = throttle_classes("feedback_report_user", "feedback_report_ip")
CAMPAIGN_CHAT_THROTTLE_CLASSES = throttle_classes("campaign_chat_user", "campaign_chat_ip")
BATTLE_WRITE_THROTTLE_CLASSES = throttle_classes("battle_write_user", "battle_write_ip")
TRADE_WRITE_THROTTLE_CLASSES = throttle_classes("trade_write_user", "trade_write_ip")
