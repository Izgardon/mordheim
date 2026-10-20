"""Removing a member from a campaign: one "Remove from campaign" (decision 1, BUG-12, BUG-50, CAMP-TWEAK-01).

Who: the owner removes any member but himself (an admin directly, without demoting him first); admins remove
players; nobody removes the owner. What: in one transaction, under the membership's row lock, his pending and
accepted trades close (`lifecycle.close`, as if he cancelled or declined them), his open battles close
(`removal_battles`), his notifications for the campaign are resolved, then the membership (role and grants) is
deleted. His warband, battles, ledger and encampments stay, so rejoining brings everything back but his grants.
After commit the battles' players get the battle events and he gets `membership_removed` on his own channel.

`preview` lists the same things first, for the Remove dialog (`GET members/<user>/removal/`).
"""

from dataclasses import dataclass, field
from typing import Any

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.battles.models import Battle
from apps.battles.serializers import battle_snapshot
from apps.battles.services.broadcast import ALL, bump_state_version, publish
from apps.battles.services.locks import locked
from apps.notifications.models import Notification
from apps.realtime.services import send_user_notification
from apps.trades.models import TradeRequest
from apps.trades.selectors import trade_requests
from apps.trades.services.lifecycle import close, expire, side_of
from apps.trades.services.timing import OPEN_STATUSES, is_due
from apps.users.names import display_name
from apps.warbands.models import Warband

from ..constants import ADMIN, OWNER, PLAYER
from ..errors import Refused
from ..models import CampaignMembership
from . import removal_battles


@dataclass
class Closed:
    """The battles removal changed, with their events and new state_version, to broadcast after commit."""

    battles: list[tuple[int, list[dict], int]] = field(default_factory=list)


def _target(campaign_id: int, user_id: int, *, lock: bool = False) -> CampaignMembership:
    rows = CampaignMembership.objects.select_related("role", "user", "campaign")
    if lock:
        rows = rows.select_for_update(of=("self",))
    target = rows.filter(campaign_id=campaign_id, user_id=user_id).first()
    if target is None:
        raise Refused("Not found", status=404)
    return target


def check_may_remove(actor: CampaignMembership, target: CampaignMembership) -> None:
    """Refused unless `actor` may remove `target` (the owner: anyone but himself; admins: players)."""
    role = actor.role.slug
    if role not in (OWNER, ADMIN):
        raise Refused("Forbidden", status=403)
    if target.role.slug == OWNER:
        raise Refused("The campaign owner can't be removed.", code="owner_not_removable")
    if role == ADMIN and target.role.slug != PLAYER:
        raise Refused("Admins can only remove players.", code="not_allowed", status=403)


def _open_trades(campaign_id: int, user_id: int):
    involved = Q(from_user_id=user_id) | Q(to_user_id=user_id)
    return trade_requests().filter(involved, campaign_id=campaign_id, status__in=OPEN_STATUSES).order_by("created_at")


def preview(actor: CampaignMembership, user_id: int) -> dict[str, Any]:
    """What removing the member will close, read without changing anything."""
    target = _target(actor.campaign_id, user_id)
    check_may_remove(actor, target)
    campaign_id = actor.campaign_id
    warband = Warband.objects.filter(campaign_id=campaign_id, user_id=user_id).only("id", "name").first()
    places = list(removal_battles.open_participations(campaign_id, user_id).prefetch_related("battle__participants"))
    trades = [trade for trade in _open_trades(campaign_id, user_id) if not is_due(trade)]
    unresolved = Notification.objects.filter(user_id=user_id, campaign_id=campaign_id, is_resolved=False)
    return {
        "member": {"id": user_id, "name": display_name(target.user), "role": target.role.slug},
        "warband": {"id": warband.id, "name": warband.name} if warband else None,  # kept; back if he rejoins
        "battles": [_battle_row(place.battle) for place in places],
        "trades": [_trade_row(trade, user_id) for trade in trades],
        "notifications": unresolved.count(),
    }


def _battle_row(battle: Battle) -> dict[str, Any]:
    return {
        "id": battle.id,
        "scenario": battle.scenario,
        "status": battle.status,
        "outcome": removal_battles.outcome(battle, battle.participants.all()),
    }


def _trade_row(trade: TradeRequest, user_id: int) -> dict[str, Any]:
    other = trade.to_user if trade.from_user_id == user_id else trade.from_user
    return {"id": str(trade.id), "status": trade.status, "with": {"id": other.id, "name": display_name(other)}}


def remove_member(actor: CampaignMembership, user_id: int, actor_user: Any) -> None:
    """Remove the member, closing what he was part of (see the module docstring); Refused when not allowed."""
    closed = Closed()
    with transaction.atomic():
        target = _target(actor.campaign_id, user_id, lock=True)
        check_may_remove(actor, target)
        _close_trades(actor.campaign_id, target.user)
        _close_battles(actor.campaign_id, user_id, actor_user, closed)
        Notification.objects.filter(user_id=user_id, campaign_id=actor.campaign_id, is_resolved=False).update(
            is_resolved=True, resolved_at=timezone.now()
        )
        campaign = target.campaign
        target.delete()
    for battle_id, events, version in closed.battles:
        publish(
            battle_snapshot(battle_id),
            events,
            version=version,
            changed=ALL,
            reason=removal_battles.REMOVAL_MODE,
            actor_user_id=actor_user.id,
            socket_id=None,
        )
    payload = {"campaign_id": campaign.id, "campaign_name": campaign.name, "removed_by": display_name(actor_user)}
    send_user_notification(user_id, "membership_removed", payload)


def _close_trades(campaign_id: int, user: Any) -> None:
    """His pending and accepted trades end as if he cancelled or declined them (one that ran out expires)."""
    for trade in _open_trades(campaign_id, user.id).select_for_update(of=("self",)):
        if is_due(trade):
            expire(trade)
        else:
            close(trade, side_of(trade, user))


def _close_battles(campaign_id: int, user_id: int, actor_user: Any, closed: Closed) -> None:
    battle_ids = sorted({place.battle_id for place in removal_battles.open_participations(campaign_id, user_id)})
    for battle in locked(Battle.objects.filter(id__in=battle_ids).order_by("id")):
        events = removal_battles.close_for_removal(battle, user_id, actor_user)
        if events:
            closed.battles.append((battle.id, events, bump_state_version(battle)))
