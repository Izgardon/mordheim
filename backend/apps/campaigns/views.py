import random
import string

from django.db.models import Count, F, FilteredRelation, Prefetch, Q
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Campaign,
    CampaignHouseRule,
    CampaignMembership,
    CampaignPermission,
    CampaignRole,
    CampaignMembershipPermission,
)
from apps.warbands.models import Warband
from .permissions import get_membership, has_campaign_permission, is_admin, is_owner
from .serializers import (
    CampaignCreateSerializer,
    CampaignHouseRuleCreateSerializer,
    CampaignHouseRuleSerializer,
    CampaignMemberSerializer,
    CampaignPermissionSerializer,
    CampaignPlayerSerializer,
    CampaignSerializer,
    JoinCampaignSerializer,
    MembershipPermissionsUpdateSerializer,
    MembershipRoleUpdateSerializer,
)

ROLE_SEED = [
    ("owner", "Owner"),
    ("admin", "Admin"),
    ("player", "Player"),
]

PERMISSION_SEED = [
    ("manage_skills", "Manage skills"),
    ("manage_items", "Manage items"),
    ("manage_races", "Manage races"),
    ("manage_rules", "Manage rules"),
    ("manage_warbands", "Manage warbands"),
]

def _ensure_roles():
    roles = {}
    for slug, name in ROLE_SEED:
        role, _ = CampaignRole.objects.get_or_create(slug=slug, defaults={"name": name})
        roles[slug] = role
    return roles


def _ensure_permissions():
    permissions = {}
    for code, name in PERMISSION_SEED:
        permission, _ = CampaignPermission.objects.get_or_create(
            code=code, defaults={"name": name}
        )
        permissions[code] = permission
    return permissions


def _generate_join_code():
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choice(alphabet) for _ in range(6))


def _unique_join_code():
    for _ in range(20):
        code = _generate_join_code()
        if not Campaign.objects.filter(join_code=code).exists():
            return code
    return _generate_join_code()


def _campaigns_for_user(user):
    return Campaign.objects.annotate(
        membership_for_user=FilteredRelation(
            "memberships", condition=Q(memberships__user=user)
        )
    ).filter(membership_for_user__isnull=False)


def _get_campaign_for_user(campaign_id, user):
    membership = get_membership(user, campaign_id)
    if not membership:
        return None

    campaign = (
        _campaigns_for_user(user)
        .filter(id=campaign_id)
        .annotate(
            player_count=Count("memberships", distinct=True),
            role=F("membership_for_user__role__slug"),
        )
    )
    return campaign.first()


class CampaignListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        campaigns = (
            _campaigns_for_user(request.user)
            .annotate(
                player_count=Count("memberships", distinct=True),
                role=F("membership_for_user__role__slug"),
            )
            .order_by("name")
        )
        serializer = CampaignSerializer(campaigns, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CampaignCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        roles = _ensure_roles()
        campaign = serializer.save(join_code=_unique_join_code())

        CampaignMembership.objects.create(
            campaign=campaign,
            user=request.user,
            role=roles["owner"],
        )

        response_serializer = CampaignSerializer(
            _campaigns_for_user(request.user)
            .filter(id=campaign.id)
            .annotate(
                player_count=Count("memberships", distinct=True),
                role=F("membership_for_user__role__slug"),
            )
            .first()
        )
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class CampaignDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        campaign = _get_campaign_for_user(campaign_id, request.user)
        if not campaign:
            return Response({"detail": "Not found"}, status=404)

        serializer = CampaignSerializer(campaign)
        return Response(serializer.data)

    def delete(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not is_owner(membership):
            return Response({"detail": "Forbidden"}, status=403)

        campaign = Campaign.objects.filter(id=campaign_id).first()
        if not campaign:
            return Response({"detail": "Not found"}, status=404)

        campaign.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class JoinCampaignView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = JoinCampaignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        join_code = serializer.validated_data["join_code"]

        campaign = Campaign.objects.filter(join_code=join_code).first()
        if not campaign:
            return Response({"detail": "Campaign not found"}, status=404)

        if CampaignMembership.objects.filter(
            campaign=campaign, user=request.user
        ).exists():
            return Response({"detail": "Already a member"}, status=400)

        player_count = CampaignMembership.objects.filter(campaign=campaign).count()
        if player_count >= campaign.max_players:
            return Response({"detail": "Campaign is full"}, status=400)

        roles = _ensure_roles()
        CampaignMembership.objects.create(
            campaign=campaign, user=request.user, role=roles["player"]
        )

        response_serializer = CampaignSerializer(
            _campaigns_for_user(request.user)
            .filter(id=campaign.id)
            .annotate(
                player_count=Count("memberships", distinct=True),
                role=F("membership_for_user__role__slug"),
            )
            .first()
        )
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class CampaignPlayersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        memberships = (
            CampaignMembership.objects.filter(campaign_id=campaign_id)
            .select_related("user")
            .order_by("user__first_name", "user__email")
        )
        warbands = Warband.objects.filter(campaign_id=campaign_id).only(
            "id", "name", "faction", "user_id"
        )
        warband_by_user = {
            warband.user_id: {
                "id": warband.id,
                "name": warband.name,
                "faction": warband.faction,
            }
            for warband in warbands
        }
        players = [
            {
                "id": member.user_id,
                "name": member.user.first_name or member.user.email,
                "warband": warband_by_user.get(member.user_id),
            }
            for member in memberships
        ]
        serializer = CampaignPlayerSerializer(players, many=True)
        return Response(serializer.data)


class CampaignMembersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not (is_owner(membership) or is_admin(membership)):
            return Response({"detail": "Forbidden"}, status=403)

        _ensure_permissions()
        memberships = (
            CampaignMembership.objects.filter(campaign_id=campaign_id)
            .select_related("user", "role")
            .prefetch_related(
                Prefetch(
                    "permissions",
                    queryset=CampaignMembershipPermission.objects.select_related("permission"),
                )
            )
            .order_by("role__slug", "user__first_name", "user__email")
        )
        members = [
            {
                "id": member.user_id,
                "name": member.user.first_name or member.user.email,
                "email": member.user.email,
                "role": member.role.slug,
                "permissions": [entry.permission.code for entry in member.permissions.all()],
            }
            for member in memberships
        ]
        serializer = CampaignMemberSerializer(members, many=True)
        return Response(serializer.data)


class CampaignPermissionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        permissions = _ensure_permissions()
        permission_by_code = {
            permission.code: permission
            for permission in CampaignPermission.objects.filter(
                code__in=permissions.keys()
            )
        }
        ordered_permissions = [
            permission_by_code[code]
            for code in permissions.keys()
            if code in permission_by_code
        ]
        serializer = CampaignPermissionSerializer(ordered_permissions, many=True)
        return Response(serializer.data)


class CampaignMyPermissionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        permissions = _ensure_permissions()
        if membership.role.slug in ("owner", "admin"):
            permission_objects = [
                permissions[code] for code in permissions.keys() if code in permissions
            ]
        else:
            permission_objects = [
                entry.permission
                for entry in CampaignMembershipPermission.objects.filter(
                    membership=membership
                ).select_related("permission")
            ]

        serializer = CampaignPermissionSerializer(permission_objects, many=True)
        return Response(serializer.data)


class CampaignMemberPermissionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, campaign_id, user_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not (is_owner(membership) or is_admin(membership)):
            return Response({"detail": "Forbidden"}, status=403)

        target_membership = (
            CampaignMembership.objects.select_related("role")
            .filter(campaign_id=campaign_id, user_id=user_id)
            .first()
        )
        if not target_membership:
            return Response({"detail": "Not found"}, status=404)
        if target_membership.role.slug in ("owner", "admin"):
            return Response(
                {"detail": "Permissions are managed automatically for admins and owners."},
                status=400,
            )

        serializer = MembershipPermissionsUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        requested = serializer.validated_data["permissions"]

        permissions = _ensure_permissions()
        allowed_permissions = [
            permissions[code] for code in requested if code in permissions
        ]

        CampaignMembershipPermission.objects.filter(
            membership=target_membership
        ).delete()
        CampaignMembershipPermission.objects.bulk_create(
            [
                CampaignMembershipPermission(
                    membership=target_membership, permission=permission
                )
                for permission in allowed_permissions
            ]
        )

        response_serializer = CampaignPermissionSerializer(allowed_permissions, many=True)
        return Response(response_serializer.data)


class CampaignMemberRoleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, campaign_id, user_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not is_owner(membership):
            return Response({"detail": "Forbidden"}, status=403)

        target_membership = (
            CampaignMembership.objects.select_related("role")
            .filter(campaign_id=campaign_id, user_id=user_id)
            .first()
        )
        if not target_membership:
            return Response({"detail": "Not found"}, status=404)
        if target_membership.role.slug == "owner":
            return Response({"detail": "Owner role cannot be changed."}, status=400)

        serializer = MembershipRoleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        requested_role = serializer.validated_data["role"]

        roles = _ensure_roles()
        target_membership.role = roles[requested_role]
        target_membership.save(update_fields=["role"])

        return Response({"id": target_membership.user_id, "role": target_membership.role.slug})


class CampaignHouseRulesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        rules = CampaignHouseRule.objects.filter(campaign_id=campaign_id).order_by(
            "created_at"
        )
        serializer = CampaignHouseRuleSerializer(rules, many=True)
        return Response(serializer.data)

    def post(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_rules"):
            return Response({"detail": "Forbidden"}, status=403)

        serializer = CampaignHouseRuleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rule = serializer.save(campaign_id=campaign_id)
        return Response(CampaignHouseRuleSerializer(rule).data, status=status.HTTP_201_CREATED)


class CampaignHouseRuleDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, campaign_id, rule_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_rules"):
            return Response({"detail": "Forbidden"}, status=403)

        rule = CampaignHouseRule.objects.filter(id=rule_id, campaign_id=campaign_id).first()
        if not rule:
            return Response({"detail": "Not found"}, status=404)

        serializer = CampaignHouseRuleCreateSerializer(rule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CampaignHouseRuleSerializer(rule).data)

    def delete(self, request, campaign_id, rule_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_rules"):
            return Response({"detail": "Forbidden"}, status=403)

        rule = CampaignHouseRule.objects.filter(id=rule_id, campaign_id=campaign_id).first()
        if not rule:
            return Response({"detail": "Not found"}, status=404)

        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
