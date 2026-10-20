"""Campaign membership reads for views outside the campaign app (warbands, catalogue, battles, realtime).

Campaign views read the same membership through `access.load_campaign_access`. Each read carries the member's
permission codes (`permission_codes`, one subquery of the same query), so `has_campaign_permission` answers without
another query (design 0.29).
"""

from django.contrib.postgres.expressions import ArraySubquery
from django.db.models import OuterRef, QuerySet

from .constants import ADMIN, OWNER
from .models import CampaignMembership, CampaignMembershipPermission

IMPLICIT_PERMISSION_ROLES = (OWNER, ADMIN)  # these roles hold every campaign permission


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
