from .models import CampaignMembership, CampaignMembershipPermission


def get_membership(user, campaign_id):
    return CampaignMembership.objects.select_related("role").filter(campaign_id=campaign_id, user=user).first()


def get_membership_with_campaign(user, campaign_id):
    """The membership with its campaign read in the same query (e.g. for its `in_progress`)."""
    rows = CampaignMembership.objects.select_related("role", "campaign")
    return rows.filter(campaign_id=campaign_id, user=user).first()


def is_owner(membership):
    return bool(membership and membership.role.slug == "owner")


def is_admin(membership):
    return bool(membership and membership.role.slug == "admin")


IMPLICIT_PERMISSION_ROLES = ("owner", "admin")  # these roles hold every campaign permission


def has_campaign_permission(membership, permission_code):
    if not membership:
        return False
    if membership.role.slug in IMPLICIT_PERMISSION_ROLES:
        return True
    return CampaignMembershipPermission.objects.filter(
        membership=membership,
        permission__code=permission_code,
    ).exists()
