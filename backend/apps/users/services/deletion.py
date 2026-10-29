"""Deleting your account (decision 1, AUTH-NEW-05).

What happens to each campaign you're in: one you own that has other members blocks the deletion until you hand it to
an admin (`hand_over_first`, pass 4's hand-over); one you're alone in is archived (`archived`), and you stay its
owner; you leave every other one with removal's clean-up (`left`: your open battles and trades close and your
notifications for it resolve). `preview` says so first, for the Delete dialog.

The deletion runs in one transaction, under the row locks of the campaigns you own, so nobody joins one between the
check and its archiving (joining takes the same lock). The user row stays, so your warbands, battles, ledger and
encampments keep their owner as retired records. It is anonymised: the name "Former player" (on your chat messages
and bulletin notes too), the username `deleted-<id>` and no email, so the address can sign up again, an unusable
password, inactive, and a new session key, so every device is signed out. Your own notifications are deleted;
notifications already sent to others keep your old name. It can't be undone.
"""

from typing import Any

from django.db import transaction
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone

from apps.battles.models import BattleParticipant
from apps.campaigns.constants import OWNER
from apps.campaigns.models import Campaign, CampaignMembership
from apps.campaigns.services import archive, removal, removal_battles
from apps.campaigns.services.authors import restamp_author_names
from apps.notifications.models import Notification
from apps.trades.models import TradeRequest
from apps.trades.services.timing import OPEN_STATUSES as OPEN_TRADE_STATUSES
from apps.warbands.models import Warband

from ..names import FORMER_PLAYER
from .tokens import end_all_sessions

HAND_OVER_FIRST = "hand_over_first"
ARCHIVED = "archived"
LEFT = "left"


class HandOverFirst(Exception):
    """The user owns campaigns with other members (`campaigns`: id and name): each goes to an admin first."""

    def __init__(self, campaigns: list[dict[str, Any]]) -> None:
        super().__init__("Campaigns to hand over first")
        self.campaigns = campaigns


def _memberships(user: Any) -> list[CampaignMembership]:
    """The user's memberships with their campaigns and roles, each knowing whether anyone else is in its campaign
    (`has_company`), by campaign name (1 query)."""
    others = CampaignMembership.objects.filter(campaign_id=OuterRef("campaign_id")).exclude(user_id=user.id)
    rows = CampaignMembership.objects.filter(user_id=user.id).select_related("campaign", "role")
    return list(rows.annotate(has_company=Exists(others)).order_by("campaign__name", "campaign_id"))


def _outcome(membership: CampaignMembership) -> str:
    if membership.role.slug != OWNER:
        return LEFT
    return HAND_OVER_FIRST if getattr(membership, "has_company", True) else ARCHIVED


def preview(user: Any) -> dict[str, Any]:
    """What deleting the account does, campaign by campaign, with the open battles and trades that close and whether
    anything blocks it (4 queries, however many campaigns)."""
    memberships = _memberships(user)
    warbands = {row.campaign_id: row for row in Warband.objects.filter(user_id=user.id).only("id", "name", "campaign")}
    campaigns = [
        {
            "id": membership.campaign_id,
            "name": membership.campaign.name,
            "role": membership.role.slug,
            "archived": membership.campaign.archived_at is not None,
            "outcome": _outcome(membership),
            "warband": _warband_row(warbands.get(membership.campaign_id)),
        }
        for membership in memberships
    ]
    return {
        "campaigns": campaigns,
        "battles": _open_battle_count(user),
        "trades": _open_trade_count(user),
        "can_delete": all(row["outcome"] != HAND_OVER_FIRST for row in campaigns),
    }


def _warband_row(warband: Warband | None) -> dict[str, Any] | None:
    return {"id": warband.id, "name": warband.name} if warband else None  # kept, as a retired record


def _open_battle_count(user: Any) -> int:
    """The open battles the user is still in: leaving cancels them or goes on without him, archiving closes them."""
    places = BattleParticipant.objects.filter(user_id=user.id, battle__status__in=removal_battles.OPEN_STATUSES)
    return places.exclude(status__in=removal_battles.DONE).values("battle_id").distinct().count()


def _open_trade_count(user: Any) -> int:
    """His pending and accepted trades that haven't run out."""
    mine = Q(from_user_id=user.id) | Q(to_user_id=user.id)
    return TradeRequest.objects.filter(mine, status__in=OPEN_TRADE_STATUSES, expires_at__gt=timezone.now()).count()


def delete_account(user: Any) -> None:
    """Delete the account as the module docstring says; HandOverFirst (nothing changed) while the user owns a
    campaign with other members."""
    with transaction.atomic():
        owned = Campaign.objects.select_for_update(of=("self",)).filter(
            memberships__user_id=user.id, memberships__role__slug=OWNER
        )
        list(owned.order_by("id").only("id"))  # locked until commit: a join waits, then finds it archived
        memberships = _memberships(user)
        blocking = [membership for membership in memberships if _outcome(membership) == HAND_OVER_FIRST]
        if blocking:
            raise HandOverFirst([{"id": row.campaign_id, "name": row.campaign.name} for row in blocking])
        _anonymise(user)  # first, so everything written from here on names him "Former player"
        for membership in memberships:
            if _outcome(membership) == LEFT:
                removal.take_out(membership.campaign_id, user.id, user, mode=removal_battles.LEAVE_MODE)
            elif membership.campaign.archived_at is None:
                archive.archive(membership.campaign_id, user)
        Notification.objects.filter(user_id=user.id).delete()


def _anonymise(user: Any) -> None:
    user.first_name, user.last_name = FORMER_PLAYER, ""
    user.username, user.email = f"deleted-{user.pk}", ""  # the address is free to sign up again
    user.set_unusable_password()
    user.is_active = False
    user.save(update_fields=["first_name", "last_name", "username", "email", "password", "is_active"])
    end_all_sessions(user)
    restamp_author_names(user)
