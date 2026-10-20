"""Roles and grants of a campaign's members (owners change roles; owners and admins change a player's grants), and
handing ownership to an admin (decision 4).

The views check who may ask (`change_roles`, `grant_permissions`, `hand_over`); these check whom it applies to,
before the request body is read, so the answers come in today's order: 404 for a non-member, 400 for an owner (or
an admin's grants), then the body's own errors. Removing a member is `removal.py`; joining is `joining.py`.
"""

from collections.abc import Iterable
from typing import Any

from django.db import transaction

from apps.realtime.services import send_user_notification

from ..constants import ADMIN, OWNER, PERMISSION_CODES
from ..errors import CampaignError, Refused, field_error
from ..models import Campaign, CampaignMembership
from . import codes


def _member(campaign_id: int, user_id: int) -> CampaignMembership:
    rows = CampaignMembership.objects.select_related("role", "campaign")
    target = rows.filter(campaign_id=campaign_id, user_id=user_id).first()
    if target is None:
        raise Refused("Not found", status=404)
    return target


def grant_target(campaign_id: int, user_id: int) -> CampaignMembership:
    """The player whose grants change: Refused for a non-member (404), an owner or an admin (400)."""
    target = _member(campaign_id, user_id)
    if target.role.slug in (OWNER, ADMIN):
        raise Refused("Permissions are managed automatically for admins and owners.")
    return target


def set_grants(target: CampaignMembership, requested: Iterable[str]) -> list[str]:
    """His grants become exactly `requested`; an unknown code refuses them all (BUG-15: it used to be dropped)."""
    requested = list(requested)
    unknown = [code for code in requested if code not in PERMISSION_CODES]
    if unknown:
        raise field_error("permissions", f"Unknown permission: {', '.join(unknown)}.", "unknown_permission")
    codes.replace_grants(target, requested)
    notify_member(target.user_id, target.campaign, "permissions", permissions=codes.in_catalogue_order(requested))
    return requested


def role_target(campaign_id: int, user_id: int) -> CampaignMembership:
    """The member whose role changes: Refused for a non-member (404) or the owner (400)."""
    target = _member(campaign_id, user_id)
    if target.role.slug == OWNER:
        raise Refused("Owner role cannot be changed.")
    return target


def change_role(target: CampaignMembership, role: str) -> None:
    """Make him an admin or a player, and tell him (`membership_changed`)."""
    set_role(target, role)
    notify_member(target.user_id, target.campaign, "role", role=role)


def notify_member(user_id: int, campaign: Campaign, change: str, **fields: Any) -> None:
    """`membership_changed` on the member's own channel, after commit: his role or grants changed, so his pages
    refetch the campaign and its capabilities (CAMP-NEW-07)."""
    payload = {"campaign_id": campaign.id, "campaign_name": campaign.name, "change": change, **fields}
    send_user_notification(user_id, "membership_changed", payload)


def set_role(target: CampaignMembership, role: str) -> None:
    """Make him an admin or a player (his grants stay, and count again if he is demoted)."""
    CampaignMembership.objects.filter(id=target.id).update(role_id=codes.role_ref(role))


def hand_over(owner: CampaignMembership, user_id: int) -> CampaignMembership:
    """The admin `user_id` becomes the owner and the owner an admin, in one transaction under both memberships'
    locks (decision 4, CAMP-NEW-02); returns the new owner's membership. Refused (standard body) for a non-member
    (404), a member who isn't an admin (400 `not_an_admin`), or an owner who has already handed over (403)."""
    with transaction.atomic():
        rows = CampaignMembership.objects.select_related("role", "campaign").select_for_update(of=("self",))
        rows = rows.order_by("id")
        both = rows.filter(campaign_id=owner.campaign_id, user_id__in=(owner.user_id, user_id))
        pair = {row.user_id: row for row in both}
        target, current = pair.get(user_id), pair.get(owner.user_id)
        if target is None:
            raise CampaignError("Not found", code="not_found", status=404)
        if current is None or current.role.slug != OWNER:  # a hand-over at the same moment got there first
            raise CampaignError("Forbidden", code="forbidden", status=403)
        if target.role.slug != ADMIN:
            detail = "Ownership can only go to an admin. Make them an admin first."
            raise CampaignError(detail, code="not_an_admin", fields={"user_id": [detail]})
        set_role(target, OWNER)
        set_role(current, ADMIN)
    notify_member(target.user_id, target.campaign, "role", role=OWNER)
    notify_member(current.user_id, current.campaign, "role", role=ADMIN)
    return target
