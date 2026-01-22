from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.permissions import get_membership, has_campaign_permission

from .models import Hero, Warband
from .serializers import (
    HeroCreateSerializer,
    HeroSerializer,
    HeroUpdateSerializer,
    WarbandCreateSerializer,
    WarbandSerializer,
    WarbandUpdateSerializer,
)


def _get_warband(warband_id):
    return Warband.objects.filter(id=warband_id).first()


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
        warbands = Warband.objects.filter(user=request.user)

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
            .prefetch_related("items", "skills")
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
        return Response(HeroSerializer(hero).data, status=status.HTTP_201_CREATED)


class WarbandHeroDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, warband_id, hero_id):
        warband = _get_warband(warband_id)
        if not warband or not _can_view_warband(request.user, warband):
            return Response({"detail": "Not found"}, status=404)
        if not _can_edit_warband(request.user, warband):
            return Response({"detail": "Forbidden"}, status=403)

        hero = Hero.objects.filter(id=hero_id, warband=warband).first()
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
