from django.db import models
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.models import Campaign
from apps.campaigns.permissions import get_membership, has_campaign_permission
from apps.restrictions.models import Restriction

from .models import (
    Item,
    ItemAvailability,
    ItemAvailabilityRestriction,
    ItemProperty,
    ItemPropertyLink,
)
from .serializers import ItemCreateSerializer, ItemPropertySerializer, ItemSerializer


def _prefetch_items():
    return Item.objects.prefetch_related(
        "property_links__property",
        models.Prefetch(
            "availabilities",
            queryset=ItemAvailability.objects.prefetch_related(
                "restriction_links__restriction"
            ),
        ),
    )


def _sync_availabilities(item, availabilities_data):
    """Replace all availability rows for an item with the given list.

    Each entry in availabilities_data can have a "restrictions" list of dicts
    with "restriction_id" and optional "additional_note".
    """
    item.availabilities.all().delete()
    if not availabilities_data:
        return
    for entry in availabilities_data:
        avail = ItemAvailability.objects.create(
            item=item,
            cost=entry.get("cost", 0),
            rarity=entry.get("rarity", 2),
            variable_cost=entry.get("variable_cost") or None,
        )
        restriction_entries = entry.get("restrictions", [])
        if restriction_entries:
            restriction_ids = [r.get("restriction_id") for r in restriction_entries]
            restrictions_by_id = {
                r.id: r
                for r in Restriction.objects.filter(id__in=restriction_ids)
            }
            links = []
            for r_entry in restriction_entries:
                r_id = r_entry.get("restriction_id")
                restriction = restrictions_by_id.get(r_id)
                if restriction:
                    links.append(
                        ItemAvailabilityRestriction(
                            item_availability=avail,
                            restriction=restriction,
                            additional_note=r_entry.get("additional_note", ""),
                        )
                    )
            if links:
                ItemAvailabilityRestriction.objects.bulk_create(links)


class ItemListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        items = _prefetch_items()
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
        if not has_campaign_permission(membership, "add_custom"):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        property_ids = data.pop("property_ids", [])
        availabilities_data = data.pop("availabilities", [])
        data["campaign"] = campaign_id
        serializer = ItemCreateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        item = serializer.save()

        if availabilities_data:
            _sync_availabilities(item, availabilities_data)

        if property_ids:
            properties = ItemProperty.objects.filter(id__in=property_ids)
            for prop in properties:
                ItemPropertyLink.objects.get_or_create(item=item, property=prop)

        item_with_links = _prefetch_items().get(id=item.id)
        return Response(ItemSerializer(item_with_links).data, status=status.HTTP_201_CREATED)


class ItemDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, item_id):
        item = _prefetch_items().filter(id=item_id).first()
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
        property_ids = data.pop("property_ids", None)
        availabilities_data = data.pop("availabilities", None)
        serializer = ItemCreateSerializer(item, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        if availabilities_data is not None:
            _sync_availabilities(item, availabilities_data)

        if property_ids is not None:
            ItemPropertyLink.objects.filter(item=item).delete()
            properties = ItemProperty.objects.filter(id__in=property_ids)
            ItemPropertyLink.objects.bulk_create(
                [ItemPropertyLink(item=item, property=prop) for prop in properties],
            )

        item_with_links = _prefetch_items().get(id=item.id)
        return Response(ItemSerializer(item_with_links).data)

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
            type_filter = item_type.strip()
            properties = properties.filter(
                models.Q(type__iexact=type_filter)
                | models.Q(type__isnull=True)
                | models.Q(type__exact="")
            )

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
        if not has_campaign_permission(membership, "add_custom"):
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
