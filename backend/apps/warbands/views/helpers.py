from apps.campaigns.permissions import get_membership, has_campaign_permission

from apps.warbands.models import Warband


def _get_warband(warband_id):
    return (
        Warband.objects.select_related("campaign")
        .prefetch_related("resources")
        .filter(id=warband_id)
        .first()
    )


def _can_view_warband(user, warband):
    return bool(get_membership(user, warband.campaign_id))


def _can_edit_warband(user, warband):
    if warband.user_id == user.id:
        return True
    membership = get_membership(user, warband.campaign_id)
    if not membership:
        return False
    return has_campaign_permission(membership, "manage_warbands")
