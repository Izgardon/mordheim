import re
import uuid
from dataclasses import dataclass
from typing import Callable

from django.utils import timezone

from apps.campaigns.permissions import get_membership
from apps.trades.models import TradeRequest

_CAMPAIGN_CHANNEL_REGEX = re.compile(r"^private-campaign-(\d+)-pings$")
_USER_CHANNEL_REGEX = re.compile(r"^private-user-(\d+)-notifications$")
_TRADE_CHANNEL_REGEX = re.compile(r"^private-trade-([0-9a-f-]+)$")


@dataclass(frozen=True)
class ChannelRule:
    name: str
    pattern: re.Pattern[str]
    authorize: Callable[[object, re.Match[str]], bool]


_CHANNEL_RULES: list[ChannelRule] = []


def register_channel_rule(rule: ChannelRule) -> None:
    _CHANNEL_RULES.append(rule)


def authorize_private_channel(user, channel_name: str) -> bool:
    if not channel_name:
        return False
    for rule in _CHANNEL_RULES:
        match = rule.pattern.match(channel_name)
        if not match:
            continue
        return rule.authorize(user, match)
    return False


def _authorize_campaign_channel(user, match: re.Match[str]) -> bool:
    campaign_id = int(match.group(1))
    return bool(get_membership(user, campaign_id))


def _authorize_user_notifications(user, match: re.Match[str]) -> bool:
    user_id = int(match.group(1))
    return bool(user and user.id == user_id)


def _authorize_trade_channel(user, match: re.Match[str]) -> bool:
    try:
        trade_id = uuid.UUID(match.group(1))
    except ValueError:
        return False
    trade_request = (
        TradeRequest.objects.select_related("from_user", "to_user")
        .filter(id=trade_id)
        .first()
    )
    if not trade_request:
        return False
    if trade_request.status in (
        TradeRequest.STATUS_DECLINED,
        TradeRequest.STATUS_EXPIRED,
        TradeRequest.STATUS_COMPLETED,
    ):
        return False
    if trade_request.expires_at <= timezone.now():
        return False
    return user.id in (trade_request.from_user_id, trade_request.to_user_id)


register_channel_rule(
    ChannelRule(
        name="campaign-pings",
        pattern=_CAMPAIGN_CHANNEL_REGEX,
        authorize=_authorize_campaign_channel,
    )
)
register_channel_rule(
    ChannelRule(
        name="user-notifications",
        pattern=_USER_CHANNEL_REGEX,
        authorize=_authorize_user_notifications,
    )
)
register_channel_rule(
    ChannelRule(
        name="trade-session",
        pattern=_TRADE_CHANNEL_REGEX,
        authorize=_authorize_trade_channel,
    )
)
