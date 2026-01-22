from .models import CampaignMembership, CampaignRolePermission


def get_membership(user, campaign_id):
    return (
        CampaignMembership.objects.select_related("role")
        .filter(campaign_id=campaign_id, user=user)
        .first()
    )


def is_owner(membership):
    return bool(membership and membership.role.slug == "owner")


def has_campaign_permission(membership, permission_code):
    if not membership:
        return False
    if membership.role.slug == "owner":
        return True
    if membership.role.slug != "admin":
        return False
    return CampaignRolePermission.objects.filter(
        campaign_id=membership.campaign_id,
        role=membership.role,
        permission__code=permission_code,
    ).exists()
