from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.permissions import get_membership

from django.db.models import Prefetch

from apps.warbands.models import Hero, Warband, WarbandLog, WarbandResource
from apps.warbands.permissions import CanEditWarband, CanViewWarband
from apps.warbands.serializers import (
    ItemSummarySerializer,
    WarbandCreateSerializer,
    WarbandLogSerializer,
    WarbandResourceCreateSerializer,
    WarbandResourceSerializer,
    WarbandResourceUpdateSerializer,
    WarbandSerializer,
    WarbandSummarySerializer,
    WarbandUpdateSerializer,
)

from .mixins import WarbandObjectMixin


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


class WarbandDetailView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        self.check_object_permissions(request, warband)
        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        serializer = WarbandSerializer(warband)
        return Response(serializer.data)

    def patch(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        serializer = WarbandUpdateSerializer(warband, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        response_serializer = WarbandSerializer(warband)
        return Response(response_serializer.data)


class WarbandSummaryView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        extra_prefetch = [
            Prefetch(
                "heroes",
                queryset=Hero.objects.select_related("race")
                .prefetch_related(
                    "hero_items__item",
                    "skills",
                    "other_entries",
                    "spells",
                )
                .order_by("id"),
            )
        ]
        warband, error_response = self.get_warband_or_404(warband_id, extra_prefetch)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        serializer = WarbandSummarySerializer(warband)
        return Response(serializer.data)


class WarbandItemListView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        items = warband.items.order_by("name", "id")
        serializer = ItemSummarySerializer(items, many=True)
        return Response(serializer.data)


class WarbandLogListView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        logs = WarbandLog.objects.filter(warband=warband)
        feature = request.query_params.get("feature")
        if feature:
            logs = logs.filter(feature__iexact=feature.strip())

        serializer = WarbandLogSerializer(logs.order_by("-created_at"), many=True)
        return Response(serializer.data)


class WarbandResourceListCreateView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        resources = WarbandResource.objects.filter(warband=warband).order_by("name")
        serializer = WarbandResourceSerializer(resources, many=True)
        return Response(serializer.data)

    def post(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        serializer = WarbandResourceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        name = serializer.validated_data["name"]
        if WarbandResource.objects.filter(warband=warband, name__iexact=name).exists():
            return Response({"detail": "Resource already exists"}, status=400)
        resource = WarbandResource.objects.create(warband=warband, name=name, amount=0)
        return Response(WarbandResourceSerializer(resource).data, status=status.HTTP_201_CREATED)


class WarbandResourceDetailView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, warband_id, resource_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        resource = WarbandResource.objects.filter(id=resource_id, warband=warband).first()
        if not resource:
            return Response({"detail": "Not found"}, status=404)

        serializer = WarbandResourceUpdateSerializer(resource, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(WarbandResourceSerializer(resource).data)

    def delete(self, request, warband_id, resource_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        resource = WarbandResource.objects.filter(id=resource_id, warband=warband).first()
        if not resource:
            return Response({"detail": "Not found"}, status=404)

        resource.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
