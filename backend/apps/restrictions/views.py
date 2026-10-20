from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.permissions import get_membership, parse_campaign_id
from apps.core.catalogue import merge

from .models import Restriction
from .serializers import RestrictionSerializer


class RestrictionListView(APIView):
    """The restrictions list. Read-only: the seeders write the book's rows (SEC-06 removed the POST, which let anyone
    signed in add a row every campaign listed)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        restrictions = Restriction.objects.all()

        search = request.query_params.get("search")
        if search:
            restrictions = restrictions.filter(restriction__icontains=search.strip())

        restriction_type = request.query_params.get("type")
        if restriction_type:
            restrictions = restrictions.filter(type__iexact=restriction_type.strip())

        campaign_id = parse_campaign_id(request.query_params.get("campaign_id"))
        if campaign_id is not None:
            membership = get_membership(request.user, campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

            rows = merge.campaign_rows(restrictions, campaign_id, "restriction")  # by text
            serializer = RestrictionSerializer(rows.order_by(*merge.campaign_first("type", "restriction")), many=True)
            return Response(serializer.data)

        serializer = RestrictionSerializer(merge.book_rows(restrictions).order_by("type", "restriction"), many=True)
        return Response(serializer.data)
