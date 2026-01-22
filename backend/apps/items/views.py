from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.models import CampaignMembership

from .models import Item
from .serializers import ItemCreateSerializer, ItemSerializer


def _get_membership_role(user, campaign_id):
    if campaign_id is None:
        return None
    return (
        CampaignMembership.objects.select_related("role")
        .filter(campaign_id=campaign_id, user=user)
        .first()
    )


class ItemListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        items = Item.objects.all()
        item_type = request.query_params.get("type")
        if item_type:
            items = items.filter(type__iexact=item_type.strip())
        search = request.query_params.get("search")
        if search:
            items = items.filter(name__icontains=search.strip())
        serializer = ItemSerializer(items, many=True)
        return Response(serializer.data)

    def post(self, request):
        campaign_id = request.data.get("campaign_id")
        membership = _get_membership_role(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if membership.role.slug not in {"owner", "admin"}:
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        serializer = ItemCreateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        item = serializer.save(custom=True)
        return Response(ItemSerializer(item).data, status=status.HTTP_201_CREATED)
