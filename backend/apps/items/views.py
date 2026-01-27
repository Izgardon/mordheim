from django.db import models
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.models import Campaign
from apps.campaigns.permissions import get_membership, has_campaign_permission

from .models import Item, ItemProperty, ItemPropertyLink
from .serializers import ItemCreateSerializer, ItemPropertySerializer, ItemSerializer


class ItemListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        items = Item.objects.prefetch_related("property_links__property")
        item_type = request.query_params.get("type")
        if item_type:
            items = items.filter(type__iexact=item_type.strip())
        search = request.query_params.get("search")
        if search:
            items = items.filter(name__icontains=search.strip())

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

            custom_items = items.filter(campaign_id=campaign_id)
            base_items = items.filter(
                campaign__isnull=True,
                campaign_types__campaign_type=campaign.campaign_type,
            )
            if custom_items.exists():
                base_items = base_items.exclude(
                    name__in=custom_items.values_list("name", flat=True)
                )
            merged = list(custom_items.order_by("name", "id")) + list(
                base_items.order_by("name", "id")
            )
            serializer = ItemSerializer(merged, many=True)
            return Response(serializer.data)

        items = items.filter(campaign__isnull=True)
        serializer = ItemSerializer(items.order_by("name", "id"), many=True)
        return Response(serializer.data)

    def post(self, request):
        campaign_id = request.data.get("campaign_id")
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "add_items"):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        property_ids = data.pop("property_ids", [])
        data["campaign"] = campaign_id
        serializer = ItemCreateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        item = serializer.save()

        if property_ids:
            properties = ItemProperty.objects.filter(id__in=property_ids)
            for prop in properties:
                ItemPropertyLink.objects.get_or_create(item=item, property=prop)

        item_with_links = Item.objects.prefetch_related("property_links__property").get(
            id=item.id
        )
        return Response(ItemSerializer(item_with_links).data, status=status.HTTP_201_CREATED)


class ItemDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, item_id):
        item = (
            Item.objects.prefetch_related("property_links__property")
            .filter(id=item_id)
            .first()
        )
        if not item:
            return Response({"detail": "Not found"}, status=404)

        if item.campaign_id:
            membership = get_membership(request.user, item.campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

        return Response(ItemSerializer(item).data)

    def patch(self, request, item_id):
        item = Item.objects.filter(id=item_id).first()
        if not item:
            return Response({"detail": "Not found"}, status=404)
        if not item.campaign_id:
            return Response({"detail": "Forbidden"}, status=403)

        membership = get_membership(request.user, item.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_items"):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        data.pop("campaign", None)
        serializer = ItemCreateSerializer(item, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ItemSerializer(item).data)

    def delete(self, request, item_id):
        item = Item.objects.filter(id=item_id).first()
        if not item:
            return Response({"detail": "Not found"}, status=404)
        if not item.campaign_id:
            return Response({"detail": "Forbidden"}, status=403)

        membership = get_membership(request.user, item.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_items"):
            return Response({"detail": "Forbidden"}, status=403)

        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ItemPropertyListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        properties = ItemProperty.objects.all()

        item_type = request.query_params.get("type")
        if item_type:
            properties = properties.filter(type__iexact=item_type.strip())

        search = request.query_params.get("search")
        if search:
            properties = properties.filter(name__icontains=search.strip())

        campaign_id = request.query_params.get("campaign_id")
        if campaign_id:
            membership = get_membership(request.user, campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

            properties = properties.filter(
                models.Q(campaign_id=campaign_id) | models.Q(campaign__isnull=True)
            )
        else:
            properties = properties.filter(campaign__isnull=True)

        serializer = ItemPropertySerializer(properties.order_by("name"), many=True)
        return Response(serializer.data)

    def post(self, request):
        campaign_id = request.data.get("campaign_id")
        if not campaign_id:
            return Response({"detail": "campaign_id is required"}, status=400)

        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "add_items"):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        data["campaign"] = campaign_id
        serializer = ItemPropertySerializer(data=data)
        serializer.is_valid(raise_exception=True)
        item_property = serializer.save()
        return Response(ItemPropertySerializer(item_property).data, status=status.HTTP_201_CREATED)


class ItemPropertyDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, property_id):
        item_property = ItemProperty.objects.filter(id=property_id).first()
        if not item_property:
            return Response({"detail": "Not found"}, status=404)

        if item_property.campaign_id:
            membership = get_membership(request.user, item_property.campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

        return Response(ItemPropertySerializer(item_property).data)
