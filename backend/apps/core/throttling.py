from __future__ import annotations

from django.conf import settings
from rest_framework.throttling import SimpleRateThrottle


class MethodScopedThrottleMixin:
    throttled_methods = frozenset({"POST"})

    def get_throttles(self):
        if self.request.method.upper() not in self.throttled_methods:
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


class AuthLoginMinuteIPRateThrottle(IPRateThrottle):
    scope = "auth_login_minute"


class AuthLoginHourIPRateThrottle(IPRateThrottle):
    scope = "auth_login_hour"


class AuthRegisterHourIPRateThrottle(IPRateThrottle):
    scope = "auth_register_hour"


class AuthRegisterDayIPRateThrottle(IPRateThrottle):
    scope = "auth_register_day"


class AuthPasswordResetHourIPRateThrottle(IPRateThrottle):
    scope = "auth_password_reset_hour"


class AuthPasswordResetDayIPRateThrottle(IPRateThrottle):
    scope = "auth_password_reset_day"


class AuthPasswordResetConfirmHourIPRateThrottle(IPRateThrottle):
    scope = "auth_password_reset_confirm_hour"


class AuthRefreshMinuteIPRateThrottle(IPRateThrottle):
    scope = "auth_refresh_minute"


class CampaignChatUserRateThrottle(UserOrIPRateThrottle):
    scope = "campaign_chat_user"


class CampaignChatIPRateThrottle(IPRateThrottle):
    scope = "campaign_chat_ip"


class CampaignPingUserRateThrottle(UserOrIPRateThrottle):
    scope = "campaign_ping_user"


class CampaignPingIPRateThrottle(IPRateThrottle):
    scope = "campaign_ping_ip"


class BattleWriteUserRateThrottle(UserOrIPRateThrottle):
    scope = "battle_write_user"


class BattleWriteIPRateThrottle(IPRateThrottle):
    scope = "battle_write_ip"


class TradeWriteUserRateThrottle(UserOrIPRateThrottle):
    scope = "trade_write_user"


class TradeWriteIPRateThrottle(IPRateThrottle):
    scope = "trade_write_ip"


LOGIN_THROTTLE_CLASSES = [
    AuthLoginMinuteIPRateThrottle,
    AuthLoginHourIPRateThrottle,
]

REGISTER_THROTTLE_CLASSES = [
    AuthRegisterHourIPRateThrottle,
    AuthRegisterDayIPRateThrottle,
]

PASSWORD_RESET_REQUEST_THROTTLE_CLASSES = [
    AuthPasswordResetHourIPRateThrottle,
    AuthPasswordResetDayIPRateThrottle,
]

PASSWORD_RESET_CONFIRM_THROTTLE_CLASSES = [
    AuthPasswordResetConfirmHourIPRateThrottle,
]

REFRESH_THROTTLE_CLASSES = [
    AuthRefreshMinuteIPRateThrottle,
]

CAMPAIGN_CHAT_THROTTLE_CLASSES = [
    CampaignChatUserRateThrottle,
    CampaignChatIPRateThrottle,
]

CAMPAIGN_PING_THROTTLE_CLASSES = [
    CampaignPingUserRateThrottle,
    CampaignPingIPRateThrottle,
]

BATTLE_WRITE_THROTTLE_CLASSES = [
    BattleWriteUserRateThrottle,
    BattleWriteIPRateThrottle,
]

TRADE_WRITE_THROTTLE_CLASSES = [
    TradeWriteUserRateThrottle,
    TradeWriteIPRateThrottle,
]
