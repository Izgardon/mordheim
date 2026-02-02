from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.models import Campaign
from apps.campaigns.permissions import get_membership, has_campaign_permission

from .models import Other
from .serializers import OtherCreateSerializer, OtherSerializer


class OtherListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        others = Other.objects.exclude(type="Hidden")
        other_type = request.query_params.get("type")
        if other_type:
            others = others.filter(type__iexact=other_type.strip())
        search = request.query_params.get("search")
        if search:
            others = others.filter(name__icontains=search.strip())

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

            campaign_others = others.filter(campaign_id=campaign_id)
            base_others = others.filter(
                campaign__isnull=True,
                campaign_types__campaign_type=campaign.campaign_type,
            )
            if campaign_others.exists():
                base_others = base_others.exclude(
                    name__in=campaign_others.values_list("name", flat=True)
                )
            merged = list(campaign_others.order_by("name", "id")) + list(
                base_others.order_by("name", "id")
            )
            serializer = OtherSerializer(merged, many=True)
            return Response(serializer.data)

        others = others.filter(campaign__isnull=True)
        serializer = OtherSerializer(others.order_by("name", "id"), many=True)
        return Response(serializer.data)

    def post(self, request):
        campaign_id = request.data.get("campaign_id")
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "add_others"):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        data["campaign"] = campaign_id
        serializer = OtherCreateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        other = serializer.save()
        return Response(OtherSerializer(other).data, status=status.HTTP_201_CREATED)


class OtherDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, other_id):
        other = Other.objects.filter(id=other_id).first()
        if not other:
            return Response({"detail": "Not found"}, status=404)

        if other.campaign_id:
            membership = get_membership(request.user, other.campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

        return Response(OtherSerializer(other).data)

    def patch(self, request, other_id):
        other = Other.objects.filter(id=other_id).first()
        if not other:
            return Response({"detail": "Not found"}, status=404)
        if not other.campaign_id:
            return Response({"detail": "Forbidden"}, status=403)

        membership = get_membership(request.user, other.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_others"):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        data.pop("campaign", None)
        serializer = OtherCreateSerializer(other, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(OtherSerializer(other).data)

    def delete(self, request, other_id):
        other = Other.objects.filter(id=other_id).first()
        if not other:
            return Response({"detail": "Not found"}, status=404)
        if not other.campaign_id:
            return Response({"detail": "Forbidden"}, status=403)

        membership = get_membership(request.user, other.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_others"):
            return Response({"detail": "Forbidden"}, status=403)

        other.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
