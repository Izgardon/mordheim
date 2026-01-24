from .models import CampaignMembership, CampaignMembershipPermission


def get_membership(user, campaign_id):
    return (
        CampaignMembership.objects.select_related("role")
        .filter(campaign_id=campaign_id, user=user)
        .first()
    )


def is_owner(membership):
    return bool(membership and membership.role.slug == "owner")


def is_admin(membership):
    return bool(membership and membership.role.slug == "admin")


def has_campaign_permission(membership, permission_code):
    if not membership:
        return False
    if membership.role.slug in ("owner", "admin"):
        return True
    return CampaignMembershipPermission.objects.filter(
        membership=membership,
        permission__code=permission_code,
    ).exists()
