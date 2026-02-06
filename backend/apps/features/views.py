from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.models import Campaign
from apps.campaigns.permissions import get_membership, has_campaign_permission

from .models import Feature
from .serializers import FeatureCreateSerializer, FeatureSerializer


class FeatureListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        features = Feature.objects.exclude(type="Pending")
        feature_type = request.query_params.get("type")
        if feature_type:
            features = features.filter(type__iexact=feature_type.strip())
        search = request.query_params.get("search")
        if search:
            features = features.filter(name__icontains=search.strip())

        campaign_id = request.query_params.get("campaign_id")
        if campaign_id:
            membership = get_membership(request.user, campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

            campaign = (
                Campaign.objects.select_related("campaign_type")
                .filter(id=campaign_id)
                .first()
            )
            if not campaign:
                return Response({"detail": "Not found"}, status=404)

            campaign_features = features.filter(campaign_id=campaign_id)
            base_features = features.filter(
                campaign__isnull=True,
                campaign_types__campaign_type=campaign.campaign_type,
            )
            if campaign_features.exists():
                base_features = base_features.exclude(
                    name__in=campaign_features.values_list("name", flat=True)
                )
            merged = list(campaign_features.order_by("name", "id")) + list(
                base_features.order_by("name", "id")
            )
            serializer = FeatureSerializer(merged, many=True)
            return Response(serializer.data)

        features = features.filter(campaign__isnull=True)
        serializer = FeatureSerializer(features.order_by("name", "id"), many=True)
        return Response(serializer.data)

    def post(self, request):
        campaign_id = request.data.get("campaign_id")
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "add_custom"):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        data["campaign"] = campaign_id
        serializer = FeatureCreateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        feature = serializer.save()
        return Response(FeatureSerializer(feature).data, status=status.HTTP_201_CREATED)


class FeatureDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, feature_id):
        feature = Feature.objects.filter(id=feature_id).first()
        if not feature:
            return Response({"detail": "Not found"}, status=404)

        if feature.campaign_id:
            membership = get_membership(request.user, feature.campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

        return Response(FeatureSerializer(feature).data)

    def patch(self, request, feature_id):
        feature = Feature.objects.filter(id=feature_id).first()
        if not feature:
            return Response({"detail": "Not found"}, status=404)
        if not feature.campaign_id:
            return Response({"detail": "Forbidden"}, status=403)

        membership = get_membership(request.user, feature.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_features"):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        data.pop("campaign", None)
        serializer = FeatureCreateSerializer(feature, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(FeatureSerializer(feature).data)

    def delete(self, request, feature_id):
        feature = Feature.objects.filter(id=feature_id).first()
        if not feature:
            return Response({"detail": "Not found"}, status=404)
        if not feature.campaign_id:
            return Response({"detail": "Forbidden"}, status=403)

        membership = get_membership(request.user, feature.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_features"):
            return Response({"detail": "Forbidden"}, status=403)

        feature.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

