from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.permissions import get_membership, has_campaign_permission
from apps.logs.utils import log_warband_event

from .models import Hero, Warband, WarbandLog, WarbandResource
from .serializers import (
    HeroCreateSerializer,
    HeroSerializer,
    HeroUpdateSerializer,
    WarbandCreateSerializer,
    WarbandLogSerializer,
    WarbandResourceCreateSerializer,
    WarbandResourceSerializer,
    WarbandResourceUpdateSerializer,
    WarbandSerializer,
    WarbandUpdateSerializer,
)


def _get_warband(warband_id):
    return Warband.objects.prefetch_related("resources").filter(id=warband_id).first()


def _can_view_warband(user, warband):
    return bool(get_membership(user, warband.campaign_id))


def _can_edit_warband(user, warband):
    if warband.user_id == user.id:
        return True
    membership = get_membership(user, warband.campaign_id)
    if not membership:
        return False
    return has_campaign_permission(membership, "manage_warbands")


class WarbandListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        campaign_id = request.query_params.get("campaign_id")
        warbands = Warband.objects.filter(user=request.user).prefetch_related("resources")

        if campaign_id:
            warbands = warbands.filter(campaign_id=campaign_id)

        serializer = WarbandSerializer(warbands.order_by("created_at"), many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = WarbandCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign_id = serializer.validated_data.get("campaign_id")

        if not get_membership(request.user, campaign_id):
            return Response({"detail": "Not found"}, status=404)

        if Warband.objects.filter(campaign_id=campaign_id, user=request.user).exists():
            return Response({"detail": "Warband already exists"}, status=400)

        warband = serializer.save(user=request.user)
        WarbandResource.objects.get_or_create(
            warband=warband, name="Treasure", defaults={"amount": 0}
        )
        response_serializer = WarbandSerializer(warband)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class WarbandDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband = _get_warband(warband_id)
        if not warband or not _can_view_warband(request.user, warband):
            return Response({"detail": "Not found"}, status=404)
        serializer = WarbandSerializer(warband)
        return Response(serializer.data)

    def patch(self, request, warband_id):
        warband = _get_warband(warband_id)
        if not warband or not _can_view_warband(request.user, warband):
            return Response({"detail": "Not found"}, status=404)
        if not _can_edit_warband(request.user, warband):
            return Response({"detail": "Forbidden"}, status=403)

        serializer = WarbandUpdateSerializer(warband, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        response_serializer = WarbandSerializer(warband)
        return Response(response_serializer.data)


class WarbandHeroListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband = _get_warband(warband_id)
        if not warband or not _can_view_warband(request.user, warband):
            return Response({"detail": "Not found"}, status=404)

        heroes = (
            Hero.objects.filter(warband=warband)
            .select_related("race")
            .prefetch_related("hero_items__item", "skills")
            .order_by("id")
        )
        serializer = HeroSerializer(heroes, many=True)
        return Response(serializer.data)

    def post(self, request, warband_id):
        warband = _get_warband(warband_id)
        if not warband or not _can_view_warband(request.user, warband):
            return Response({"detail": "Not found"}, status=404)
        if not _can_edit_warband(request.user, warband):
            return Response({"detail": "Forbidden"}, status=403)

        if Hero.objects.filter(warband=warband).count() >= 6:
            return Response({"detail": "Warband already has 6 heroes"}, status=400)

        serializer = HeroCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        hero = serializer.save(warband=warband)
        log_warband_event(
            warband.id,
            "personnel",
            "new_hero",
            {"name": hero.name or "Unknown", "type": hero.unit_type or "Unknown"},
        )
        return Response(HeroSerializer(hero).data, status=status.HTTP_201_CREATED)


class WarbandHeroDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, warband_id, hero_id):
        warband = _get_warband(warband_id)
        if not warband or not _can_view_warband(request.user, warband):
            return Response({"detail": "Not found"}, status=404)
        if not _can_edit_warband(request.user, warband):
            return Response({"detail": "Forbidden"}, status=403)

        hero = (
            Hero.objects.filter(id=hero_id, warband=warband)
            .select_related("race")
            .prefetch_related("hero_items__item", "skills")
            .first()
        )
        if not hero:
            return Response({"detail": "Not found"}, status=404)

        serializer = HeroUpdateSerializer(hero, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(HeroSerializer(hero).data)

    def delete(self, request, warband_id, hero_id):
        warband = _get_warband(warband_id)
        if not warband or not _can_view_warband(request.user, warband):
            return Response({"detail": "Not found"}, status=404)
        if not _can_edit_warband(request.user, warband):
            return Response({"detail": "Forbidden"}, status=403)

        hero = Hero.objects.filter(id=hero_id, warband=warband).first()
        if not hero:
            return Response({"detail": "Not found"}, status=404)

        hero.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WarbandLogListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband = _get_warband(warband_id)
        if not warband or not _can_view_warband(request.user, warband):
            return Response({"detail": "Not found"}, status=404)

        logs = WarbandLog.objects.filter(warband=warband)
        feature = request.query_params.get("feature")
        if feature:
            logs = logs.filter(feature__iexact=feature.strip())

        serializer = WarbandLogSerializer(logs.order_by("-created_at"), many=True)
        return Response(serializer.data)


class WarbandResourceListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband = _get_warband(warband_id)
        if not warband or not _can_view_warband(request.user, warband):
            return Response({"detail": "Not found"}, status=404)

        resources = WarbandResource.objects.filter(warband=warband).order_by("name")
        serializer = WarbandResourceSerializer(resources, many=True)
        return Response(serializer.data)

    def post(self, request, warband_id):
        warband = _get_warband(warband_id)
        if not warband or not _can_view_warband(request.user, warband):
            return Response({"detail": "Not found"}, status=404)
        if not _can_edit_warband(request.user, warband):
            return Response({"detail": "Forbidden"}, status=403)

        serializer = WarbandResourceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        name = serializer.validated_data["name"]
        if WarbandResource.objects.filter(warband=warband, name__iexact=name).exists():
            return Response({"detail": "Resource already exists"}, status=400)
        resource = WarbandResource.objects.create(warband=warband, name=name, amount=0)
        return Response(WarbandResourceSerializer(resource).data, status=status.HTTP_201_CREATED)


class WarbandResourceDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, warband_id, resource_id):
        warband = _get_warband(warband_id)
        if not warband or not _can_view_warband(request.user, warband):
            return Response({"detail": "Not found"}, status=404)
        if not _can_edit_warband(request.user, warband):
            return Response({"detail": "Forbidden"}, status=403)

        resource = (
            WarbandResource.objects.filter(id=resource_id, warband=warband).first()
        )
        if not resource:
            return Response({"detail": "Not found"}, status=404)

        serializer = WarbandResourceUpdateSerializer(resource, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(WarbandResourceSerializer(resource).data)

    def delete(self, request, warband_id, resource_id):
        warband = _get_warband(warband_id)
        if not warband or not _can_view_warband(request.user, warband):
            return Response({"detail": "Not found"}, status=404)
        if not _can_edit_warband(request.user, warband):
            return Response({"detail": "Forbidden"}, status=403)

        resource = (
            WarbandResource.objects.filter(id=resource_id, warband=warband).first()
        )
        if not resource:
            return Response({"detail": "Not found"}, status=404)

        resource.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
