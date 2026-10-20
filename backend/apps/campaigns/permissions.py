"""Campaign membership reads for views outside the campaign app (warbands, catalogue, battles, realtime).

Campaign views read the same membership through `access.load_campaign_access`. Each read carries the member's
permission codes (`permission_codes`, one subquery of the same query), so `has_campaign_permission` answers without
another query (design 0.29).
"""

from typing import Any

from django.contrib.postgres.expressions import ArraySubquery
from django.db.models import OuterRef, QuerySet

from apps.core.errors import ApiError

from .constants import ADMIN, OWNER
from .errors import CampaignArchived
from .models import CampaignMembership, CampaignMembershipPermission

IMPLICIT_PERMISSION_ROLES = (OWNER, ADMIN)  # these roles hold every campaign permission


def parse_campaign_id(value: Any, field: str = "campaign_id") -> int | None:
    """A campaign id sent in a query string or a body: None when it is absent or blank, the id when it is a whole
    number, and a 400 in the standard body otherwise (BUG-79: `abc` or `1.5` was a 500)."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    detail = f"{field} must be a campaign's id."
    raise ApiError(detail, code="invalid", fields={field: [detail]})


def with_codes(rows: QuerySet[CampaignMembership]) -> QuerySet[CampaignMembership]:
    """The memberships, each with the codes granted to it as `permission_codes` (in the same query)."""
    granted = CampaignMembershipPermission.objects.filter(membership=OuterRef("pk")).values("permission__code")
    return rows.annotate(permission_codes=ArraySubquery(granted))


def get_membership(user, campaign_id):
    return (
        with_codes(CampaignMembership.objects.select_related("role")).filter(campaign_id=campaign_id, user=user).first()
    )


def get_membership_with_campaign(user, campaign_id):
    """The membership with its campaign read in the same query (e.g. for its `in_progress`)."""
    rows = with_codes(CampaignMembership.objects.select_related("role", "campaign"))
    return rows.filter(campaign_id=campaign_id, user=user).first()


def get_writable_membership(user, campaign_id):
    """The membership for a write in the campaign, read with its campaign (one query, as above): None for a
    non-member; CampaignArchived (403 campaign_archived) when the campaign is archived (decision 5)."""
    membership = get_membership_with_campaign(user, campaign_id)
    if membership is not None and membership.campaign.archived_at is not None:
        raise CampaignArchived()
    return membership


def is_owner(membership):
    return bool(membership and membership.role.slug == OWNER)


def is_admin(membership):
    return bool(membership and membership.role.slug == ADMIN)


def has_campaign_permission(membership, permission_code):
    if not membership:
        return False
    if membership.role.slug in IMPLICIT_PERMISSION_ROLES:
        return True
    held = getattr(membership, "permission_codes", None)
    if held is not None:  # read with the membership (with_codes)
        return permission_code in held
    return CampaignMembershipPermission.objects.filter(
        membership=membership,
        permission__code=permission_code,
    ).exists()
