from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.models import Campaign
from apps.campaigns.permissions import get_membership, has_campaign_permission

from .models import Special
from .serializers import SpecialCreateSerializer, SpecialSerializer


class SpecialListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        specials = Special.objects.exclude(type="Pending")
        special_type = request.query_params.get("type")
        if special_type:
            specials = specials.filter(type__iexact=special_type.strip())
        search = request.query_params.get("search")
        if search:
            specials = specials.filter(name__icontains=search.strip())

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

            campaign_specials = specials.filter(campaign_id=campaign_id)
            base_specials = specials.filter(
                campaign__isnull=True,
                campaign_types__campaign_type=campaign.campaign_type,
            )
            if campaign_specials.exists():
                base_specials = base_specials.exclude(
                    name__in=campaign_specials.values_list("name", flat=True)
                )
            merged = list(campaign_specials.order_by("name", "id")) + list(
                base_specials.order_by("name", "id")
            )
            serializer = SpecialSerializer(merged, many=True)
            return Response(serializer.data)

        specials = specials.filter(campaign__isnull=True)
        serializer = SpecialSerializer(specials.order_by("name", "id"), many=True)
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
        serializer = SpecialCreateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        special = serializer.save()
        return Response(SpecialSerializer(special).data, status=status.HTTP_201_CREATED)


class SpecialDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, special_id):
        special = Special.objects.filter(id=special_id).first()
        if not special:
            return Response({"detail": "Not found"}, status=404)

        if special.campaign_id:
            membership = get_membership(request.user, special.campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

        return Response(SpecialSerializer(special).data)

    def patch(self, request, special_id):
        special = Special.objects.filter(id=special_id).first()
        if not special:
            return Response({"detail": "Not found"}, status=404)
        if not special.campaign_id:
            return Response({"detail": "Forbidden"}, status=403)

        membership = get_membership(request.user, special.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_features"):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        data.pop("campaign", None)
        serializer = SpecialCreateSerializer(special, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(SpecialSerializer(special).data)

    def delete(self, request, special_id):
        special = Special.objects.filter(id=special_id).first()
        if not special:
            return Response({"detail": "Not found"}, status=404)
        if not special.campaign_id:
            return Response({"detail": "Forbidden"}, status=403)

        membership = get_membership(request.user, special.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_features"):
            return Response({"detail": "Forbidden"}, status=403)

        special.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
