from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.permissions import get_membership, has_campaign_permission

from .models import Item
from .serializers import ItemCreateSerializer, ItemSerializer


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
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_items"):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        serializer = ItemCreateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        item = serializer.save(custom=True)
        return Response(ItemSerializer(item).data, status=status.HTTP_201_CREATED)
