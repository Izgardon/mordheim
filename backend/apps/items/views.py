from django.db import models
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.permissions import (
    get_membership,
    get_writable_membership,
    has_campaign_permission,
    parse_campaign_id,
)
from apps.core.catalogue.usage import delete_unless_in_use

from . import writes
from .models import Item, ItemAvailability, ItemProperty
from .serializers import ItemPropertySerializer, ItemSerializer, ItemWriteSerializer

HOUSE_RULE_ITEM = {
    "detail": "This item comes from a house rule and changes with it. Edit or delete the house rule instead.",
    "code": "house_rule_item",
}  # BUG-51: editing or deleting a generated clone was lost on the next sync or cascaded to every owned copy


def _prefetch_items():
    return Item.objects.prefetch_related(
        "property_links__property",
        "bestiary_entry__specials",
        models.Prefetch(
            "availabilities",
            queryset=ItemAvailability.objects.prefetch_related("restriction_links__restriction"),
        ),
    )


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

        campaign_id = parse_campaign_id(request.query_params.get("campaign_id"))
        if campaign_id is not None:
            membership = get_membership(request.user, campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

            custom_items = items.filter(campaign_id=campaign_id)
            base_items = items.filter(campaign__isnull=True)
            if custom_items.exists():
                base_items = base_items.exclude(name__in=custom_items.values_list("name", flat=True))
            merged = list(custom_items.order_by("name", "id")) + list(base_items.order_by("name", "id"))
            serializer = ItemSerializer(merged, many=True)
            return Response(serializer.data)

        items = items.filter(campaign__isnull=True)
        serializer = ItemSerializer(items.order_by("name", "id"), many=True)
        return Response(serializer.data)

    def post(self, request):
        campaign_id = parse_campaign_id(request.data.get("campaign_id"))
        membership = get_writable_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "edit_catalogue"):
            return Response({"detail": "Forbidden"}, status=403)

        serializer = ItemWriteSerializer(data=request.data, context={"campaign_id": campaign_id})
        serializer.is_valid(raise_exception=True)  # costs, rarities and linked ids, before anything is written
        item = writes.create_item(membership.campaign_id, serializer.validated_data)
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

        membership = get_writable_membership(request.user, item.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if item.generated_effect_key:
            return Response(HOUSE_RULE_ITEM, status=403)
        if not has_campaign_permission(membership, "edit_catalogue"):
            return Response({"detail": "Forbidden"}, status=403)

        context = {"campaign_id": item.campaign_id}
        serializer = ItemWriteSerializer(item, data=request.data, partial=True, context=context)
        serializer.is_valid(raise_exception=True)
        writes.update_item(item, serializer.validated_data)
        item_with_links = _prefetch_items().get(id=item.id)
        return Response(ItemSerializer(item_with_links).data)

    def delete(self, request, item_id):
        item = Item.objects.filter(id=item_id).first()
        if not item:
            return Response({"detail": "Not found"}, status=404)
        if not item.campaign_id:
            return Response({"detail": "Forbidden"}, status=403)

        membership = get_writable_membership(request.user, item.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if item.generated_effect_key:
            return Response(HOUSE_RULE_ITEM, status=403)
        if not has_campaign_permission(membership, "delete_catalogue"):
            return Response({"detail": "Forbidden"}, status=403)

        delete_unless_in_use(item, "item")  # 409 in_use when anything holds it (BUG-16)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ItemPropertyListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        properties = ItemProperty.objects.all()

        item_type = request.query_params.get("type")
        if item_type:
            type_filter = item_type.strip()
            properties = properties.filter(
                models.Q(type__iexact=type_filter) | models.Q(type__isnull=True) | models.Q(type__exact="")
            )

        search = request.query_params.get("search")
        if search:
            properties = properties.filter(name__icontains=search.strip())

        campaign_id = parse_campaign_id(request.query_params.get("campaign_id"))
        if campaign_id is not None:
            membership = get_membership(request.user, campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

            properties = properties.filter(models.Q(campaign_id=campaign_id) | models.Q(campaign__isnull=True))
        else:
            properties = properties.filter(campaign__isnull=True)

        serializer = ItemPropertySerializer(properties.order_by("name"), many=True)
        return Response(serializer.data)

    def post(self, request):
        campaign_id = parse_campaign_id(request.data.get("campaign_id"))
        if campaign_id is None:
            return Response({"detail": "campaign_id is required"}, status=400)

        membership = get_writable_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "edit_catalogue"):
            return Response({"detail": "Forbidden"}, status=403)

        serializer = ItemPropertySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item_property = serializer.save(campaign_id=campaign_id)  # the campaign's own property (BUG-145)
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
