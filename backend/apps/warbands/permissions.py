"""
Permission classes for warband views.
"""

from rest_framework import permissions

from apps.campaigns.permissions import get_membership, has_campaign_permission
from apps.warbands.models import Warband


class CanViewWarband(permissions.BasePermission):
    """
    Permission to check if user can view a warband.
    Requires membership in the warband's campaign.
    """

    message = "Not found"

    def has_object_permission(self, request, view, obj):
        if not isinstance(obj, Warband):
            return False
        return bool(get_membership(request.user, obj.campaign_id))


class CanEditWarband(permissions.BasePermission):
    """
    Permission to check if user can edit a warband.
    User must either own the warband or have manage_warbands permission.
    """

    message = "Forbidden"

    def has_object_permission(self, request, view, obj):
        if not isinstance(obj, Warband):
            return False

        # Owner can always edit
        if obj.user_id == request.user.id:
            return True

        # Check if user has manage_warbands permission
        membership = get_membership(request.user, obj.campaign_id)
        if not membership:
            return False

        return has_campaign_permission(membership, "manage_warbands")
