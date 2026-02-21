from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.models import Campaign
from apps.campaigns.permissions import get_membership

from .models import Restriction
from .serializers import RestrictionSerializer


class RestrictionListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        restrictions = Restriction.objects.all()

        search = request.query_params.get("search")
        if search:
            restrictions = restrictions.filter(restriction__icontains=search.strip())

        restriction_type = request.query_params.get("type")
        if restriction_type:
            restrictions = restrictions.filter(type__iexact=restriction_type.strip())

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

            custom = restrictions.filter(campaign_id=campaign_id)
            base = restrictions.filter(
                campaign__isnull=True,
                campaign_types__campaign_type=campaign.campaign_type,
            )
            if custom.exists():
                base = base.exclude(
                    restriction__in=custom.values_list("restriction", flat=True)
                )
            merged = list(custom.order_by("type", "restriction")) + list(
                base.order_by("type", "restriction")
            )
            serializer = RestrictionSerializer(merged, many=True)
            return Response(serializer.data)

        restrictions = restrictions.filter(campaign__isnull=True)
        serializer = RestrictionSerializer(restrictions, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = RestrictionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        restriction = serializer.save()
        return Response(
            RestrictionSerializer(restriction).data,
            status=status.HTTP_201_CREATED,
        )
