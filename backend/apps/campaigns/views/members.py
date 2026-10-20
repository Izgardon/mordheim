"""Members, their roles and grants, the permission catalogue, removing a member (decision 1) and handing ownership
to an admin and leaving (decision 4)."""

from rest_framework import status
from rest_framework.response import Response

from ..selectors import members_payload
from ..serializers.members import (
    CampaignMemberSerializer,
    MembershipPermissionsUpdateSerializer,
    MembershipRoleUpdateSerializer,
    OwnershipSerializer,
)
from ..services import codes, leaving, membership, removal
from .base import CampaignScopedView


class CampaignMembersView(CampaignScopedView):
    """GET: the members with their roles, grants, emails and warbands, for owners and admins."""

    rules = {"GET": "view_members"}

    def get(self, request, campaign_id):
        return Response(CampaignMemberSerializer(members_payload(campaign_id), many=True).data)


class CampaignPermissionsView(CampaignScopedView):
    """GET: every permission code with its label and description (the grant menu)."""

    def get(self, request, campaign_id):
        return Response(codes.describe())


class CampaignMyPermissionsView(CampaignScopedView):
    """GET: the codes the caller holds, in the catalogue's order (every code for owners and admins)."""

    def get(self, request, campaign_id):
        return Response(codes.describe(codes.in_catalogue_order(self.access.codes)))


class CampaignMemberPermissionsView(CampaignScopedView):
    """PUT: a player's grants become exactly the codes sent (owners and admins; BUG-15: unknown codes refused)."""

    rules = {"PUT": "grant_permissions"}

    def put(self, request, campaign_id, user_id):
        target = membership.grant_target(campaign_id, user_id)
        serializer = MembershipPermissionsUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(codes.describe(membership.set_grants(target, serializer.validated_data["permissions"])))


class CampaignMemberRoleView(CampaignScopedView):
    """PATCH: the owner makes a member an admin or a player (the owner's own role never changes)."""

    rules = {"PATCH": "change_roles"}

    def patch(self, request, campaign_id, user_id):
        target = membership.role_target(campaign_id, user_id)
        serializer = MembershipRoleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership.change_role(target, serializer.validated_data["role"])
        return Response({"id": target.user_id, "role": serializer.validated_data["role"]})


class CampaignMemberRemoveView(CampaignScopedView):
    """DELETE: remove the member; his battles and trades close, his warband stays (decision 1, BUG-12, BUG-50).

    Who may remove whom is the service's (`removal.check_may_remove`), checked after the target is found, so a
    missing target is 404 for everyone."""

    rules = {"DELETE": "view"}

    def delete(self, request, campaign_id, user_id):
        removal.remove_member(self.access.membership, user_id, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CampaignMemberRemovalPreviewView(CampaignScopedView):
    """GET: what removing the member will close, for the Remove dialog (decision 1); refused as the DELETE is."""

    def get(self, request, campaign_id, user_id):
        return Response(removal.preview(self.access.membership, user_id))


class CampaignOwnershipView(CampaignScopedView):
    """POST: the owner hands ownership to an admin and becomes an admin (decision 4, CAMP-NEW-02)."""

    rules = {"POST": "hand_over"}

    def post(self, request, campaign_id):
        serializer = OwnershipSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_owner = membership.hand_over(self.access.membership, serializer.validated_data["user_id"])
        return Response({"owner_id": new_owner.user_id, "previous_owner_id": request.user.id})


class CampaignLeaveView(CampaignScopedView):
    """GET: what leaving will close (refused as leaving is). POST: the caller leaves the campaign, with removal's
    clean-up; the owner hands ownership over first, unless he is alone, when leaving archives the campaign
    (decision 4, CAMP-NEW-03). Answers `{"outcome": "left" | "archived"}`."""

    rules = {"GET": "view", "POST": "view"}  # who may leave is the service's (leaving.py)

    def get(self, request, campaign_id):
        return Response(leaving.preview(self.access.membership))

    def post(self, request, campaign_id):
        return Response({"outcome": leaving.leave(self.access.membership, request.user)})
