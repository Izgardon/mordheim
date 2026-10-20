"""Roles and grants of a campaign's members (owners change roles; owners and admins change a player's grants).

The views check who may ask (`change_roles`, `grant_permissions`); these check whom it applies to, before the
request body is read, so the answers come in today's order: 404 for a non-member, 400 for an owner (or an admin's
grants), then the body's own errors. Removing a member is `removal.py`; joining is `joining.py`.
"""

from collections.abc import Iterable

from ..constants import ADMIN, OWNER, PERMISSION_CODES
from ..errors import Refused, field_error
from ..models import CampaignMembership
from . import codes


def _member(campaign_id: int, user_id: int) -> CampaignMembership:
    target = CampaignMembership.objects.select_related("role").filter(campaign_id=campaign_id, user_id=user_id).first()
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
    return requested


def role_target(campaign_id: int, user_id: int) -> CampaignMembership:
    """The member whose role changes: Refused for a non-member (404) or the owner (400)."""
    target = _member(campaign_id, user_id)
    if target.role.slug == OWNER:
        raise Refused("Owner role cannot be changed.")
    return target


def set_role(target: CampaignMembership, role: str) -> None:
    """Make him an admin or a player (his grants stay, and count again if he is demoted)."""
    CampaignMembership.objects.filter(id=target.id).update(role_id=codes.role_ref(role))
