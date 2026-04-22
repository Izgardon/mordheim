from django.db import transaction
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.models import CampaignSettings
from apps.campaigns.permissions import get_membership
from apps.items.models import Item
from apps.logs.utils import log_warband_event
from apps.restrictions.serializers import RestrictionSerializer
from apps.warbands.models import (
    HenchmenGroup,
    HenchmenGroupItem,
    Hero,
    HeroItem,
    HiredSword,
    HiredSwordItem,
    Warband,
    WarbandItem,
    WarbandLog,
    WarbandResource,
    WarbandTrade,
)
from apps.warbands.permissions import CanEditWarband, CanViewWarband
from apps.warbands.restrictions import (
    get_effective_restrictions_for_warband,
)
from apps.warbands.serializers import (
    HenchmenGroupDetailSerializer,
    HeroDetailSerializer,
    HiredSwordDetailSerializer,
    WarbandCreateSerializer,
    WarbandItemSaleSerializer,
    WarbandItemSummarySerializer,
    WarbandItemTransferSerializer,
    WarbandLogCreateSerializer,
    WarbandLogSerializer,
    WarbandResourceCreateSerializer,
    WarbandResourceSerializer,
    WarbandResourceUpdateSerializer,
    WarbandSerializer,
    WarbandSummarySerializer,
    WarbandTradeCreateSerializer,
    WarbandTradeSerializer,
    WarbandUpdateSerializer,
)
from apps.warbands.utils.trades import TradeHelper

from .mixins import WarbandObjectMixin


UNIT_TYPE_CONFIG = {
    "hero": {
        "model": Hero,
        "item_model": HeroItem,
        "parent_field": "hero",
        "serializer": HeroDetailSerializer,
        "prefetch": (
            "hero_items__item__property_links__property",
            "hero_skills__skill",
            "hero_specials__special",
            "hero_spells__spell",
        ),
    },
    "hired_sword": {
        "model": HiredSword,
        "item_model": HiredSwordItem,
        "parent_field": "hired_sword",
        "serializer": HiredSwordDetailSerializer,
        "prefetch": (
            "hired_sword_items__item__property_links__property",
            "hired_sword_skills__skill",
            "hired_sword_specials__special",
            "hired_sword_spells__spell",
        ),
    },
    "henchmen_group": {
        "model": HenchmenGroup,
        "item_model": HenchmenGroupItem,
        "parent_field": "henchmen_group",
        "serializer": HenchmenGroupDetailSerializer,
        "prefetch": (
            "henchmen_group_items__item__property_links__property",
            "henchmen_group_skills__skill",
            "henchmen_group_specials__special",
            "henchmen",
        ),
    },
}


def _get_unit_instance(warband, unit_type, unit_id):
    config = UNIT_TYPE_CONFIG[unit_type]
    queryset = config["model"].objects.filter(id=unit_id, warband=warband, dead=False).select_related("race")
    queryset = queryset.prefetch_related(*config["prefetch"])
    return queryset.first()


def _serialize_unit_instance(instance, unit_type):
    if instance is None:
        return None
    return UNIT_TYPE_CONFIG[unit_type]["serializer"](instance).data


def _remove_unit_items(unit_type, unit, item_id, quantity):
    config = UNIT_TYPE_CONFIG[unit_type]
    rows = list(
        config["item_model"]
        .objects.filter(**{config["parent_field"]: unit, "item_id": item_id})
        .order_by("-id")[:quantity]
    )
    if len(rows) < quantity:
        raise ValueError("Item not found.")
    costs = [row.cost for row in rows]
    config["item_model"].objects.filter(id__in=[row.id for row in rows]).delete()
    return costs


def _add_unit_items(unit_type, unit, item, costs):
    if not costs:
        return
    config = UNIT_TYPE_CONFIG[unit_type]
    parent_field = config["parent_field"]
    rows = []
    for cost in costs:
        kwargs = {
            parent_field: unit,
            "item": item,
        }
        if cost is not None:
            kwargs["cost"] = cost
        rows.append(config["item_model"](**kwargs))
    config["item_model"].objects.bulk_create(rows)


def _remove_stash_items(warband, item_id, quantity):
    stash_item = WarbandItem.objects.filter(warband=warband, item_id=item_id).select_related("item").first()
    if not stash_item or (stash_item.quantity or 0) < quantity:
        raise ValueError("Item not found in stash.")
    costs = [stash_item.cost] * quantity
    remaining = (stash_item.quantity or 0) - quantity
    if remaining <= 0:
        stash_item.delete()
        return costs, None
    stash_item.quantity = remaining
    stash_item.save(update_fields=["quantity"])
    stash_item.refresh_from_db()
    return costs, stash_item


def _add_stash_items(warband, item, costs):
    quantity = len(costs)
    if quantity <= 0:
        return None
    stash_item = WarbandItem.objects.filter(warband=warband, item=item).select_related("item").first()
    next_cost = next((cost for cost in reversed(costs) if cost is not None), None)
    if stash_item:
        stash_item.quantity = (stash_item.quantity or 0) + quantity
        if next_cost is not None:
            stash_item.cost = next_cost
            stash_item.save(update_fields=["quantity", "cost"])
        else:
            stash_item.save(update_fields=["quantity"])
        stash_item.refresh_from_db()
        return stash_item
    create_kwargs = {"warband": warband, "item": item, "quantity": quantity}
    if next_cost is not None:
        create_kwargs["cost"] = next_cost
    return WarbandItem.objects.create(**create_kwargs)


def _build_item_change_response(
    warband,
    *,
    source=None,
    target=None,
    stash_item=None,
    removed_stash_item_id=None,
):
    return {
        "summary": WarbandSummarySerializer(warband).data,
        "source": source,
        "target": target,
        "stash_item": WarbandItemSummarySerializer(stash_item).data if stash_item else None,
        "removed_stash_item_id": removed_stash_item_id,
    }

class WarbandListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        campaign_id = request.query_params.get("campaign_id")
        warbands = (
            Warband.objects.filter(user=request.user)
            .select_related("campaign", "campaign__settings")
            .prefetch_related("resources", "restrictions", "campaign__settings__item_settings")
        )

        if campaign_id:
            warbands = warbands.filter(campaign_id=campaign_id)

        serializer = WarbandSerializer(warbands.order_by("created_at"), many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = WarbandCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign_id = serializer.validated_data.get("campaign_id")

        if not get_membership(request.user, campaign_id):
            return Response({"detail": "Not found"}, status=404)

        if Warband.objects.filter(campaign_id=campaign_id, user=request.user).exists():
            return Response({"detail": "Warband already exists"}, status=400)

        serializer.validated_data.pop("restriction_ids", [])
        warband = serializer.save(user=request.user)
        WarbandResource.objects.get_or_create(warband=warband, name="Treasure", defaults={"amount": 0})
        settings = CampaignSettings.objects.filter(campaign_id=campaign_id).first()
        starting_gold = settings.starting_gold if settings else 500
        TradeHelper.upsert_starting_gold_trade(warband, starting_gold)
        response_serializer = WarbandSerializer(warband)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class WarbandDetailView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        self.check_object_permissions(request, warband)
        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        serializer = WarbandSerializer(warband)
        return Response(serializer.data)

    def patch(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        serializer = WarbandUpdateSerializer(warband, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.validated_data.pop("restriction_ids", None)
        serializer.save()
        response_serializer = WarbandSerializer(warband)
        return Response(response_serializer.data)

    def delete(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        # Only the warband owner can delete their own warband
        if warband.user_id != request.user.id:
            return Response({"detail": "Forbidden"}, status=403)

        warband.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WarbandSummaryView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        serializer = WarbandSummarySerializer(warband)
        return Response(serializer.data)


class WarbandItemListView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        items = WarbandItem.objects.filter(warband=warband).select_related("item").order_by("item__name", "item__id")
        serializer = WarbandItemSummarySerializer(items, many=True)
        return Response(serializer.data)

    def post(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        item_id = request.data.get("item_id")
        try:
            item_id = int(item_id)
        except (TypeError, ValueError):
            return Response({"detail": "Invalid item id"}, status=400)

        quantity = request.data.get("quantity", 1)
        try:
            quantity = max(1, int(quantity))
        except (TypeError, ValueError):
            quantity = 1

        cost = request.data.get("cost")
        if cost is not None:
            try:
                cost = int(cost)
            except (TypeError, ValueError):
                cost = None

        item = Item.objects.filter(id=item_id).first()
        if not item:
            return Response({"detail": "Item not found"}, status=404)
        if cost is None:
            availabilities = list(item.availabilities.all())
            if len(availabilities) == 1:
                cost = availabilities[0].cost

        warband_item = WarbandItem.objects.filter(warband=warband, item=item).first()
        if warband_item:
            warband_item.quantity = (warband_item.quantity or 0) + quantity
            if cost is not None:
                warband_item.cost = cost
            warband_item.save(update_fields=["quantity", "cost"])
        else:
            warband_item = WarbandItem.objects.create(warband=warband, item=item, quantity=quantity, cost=cost)

        return Response(
            WarbandItemSummarySerializer(warband_item).data,
            status=status.HTTP_201_CREATED,
        )


class WarbandItemDetailView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, warband_id, item_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        warband_item = WarbandItem.objects.filter(warband=warband, item_id=item_id).first()
        if not warband_item:
            return Response({"detail": "Item not found in stash"}, status=404)

        qty = 1
        try:
            qty = max(1, int(request.data.get("quantity", 1)))
        except (TypeError, ValueError):
            qty = 1

        new_quantity = (warband_item.quantity or 1) - qty
        if new_quantity <= 0:
            warband_item.delete()
        else:
            warband_item.quantity = new_quantity
            warband_item.save(update_fields=["quantity"])

        return Response(status=status.HTTP_204_NO_CONTENT)


class WarbandItemTransferView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        serializer = WarbandItemTransferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item_id = serializer.validated_data["item_id"]
        quantity = serializer.validated_data["quantity"]
        item = Item.objects.filter(id=item_id).first()
        if not item:
            return Response({"detail": "Item not found"}, status=404)

        source_type = serializer.validated_data["source_type"]
        source_id = serializer.validated_data.get("source_id")
        target_type = serializer.validated_data["target_type"]
        target_id = serializer.validated_data.get("target_id")

        try:
            with transaction.atomic():
                stash_item = None
                removed_stash_item_id = None
                source_unit = None
                target_unit = None

                if source_type == "stash":
                    costs, stash_item = _remove_stash_items(warband, item_id, quantity)
                    if stash_item is None:
                        removed_stash_item_id = item_id
                else:
                    source_unit = _get_unit_instance(warband, source_type, source_id)
                    if not source_unit:
                        return Response({"detail": "Source not found"}, status=404)
                    costs = _remove_unit_items(source_type, source_unit, item_id, quantity)

                if target_type == "stash":
                    stash_item = _add_stash_items(warband, item, costs)
                else:
                    target_unit = _get_unit_instance(warband, target_type, target_id)
                    if not target_unit:
                        return Response({"detail": "Target not found"}, status=404)
                    _add_unit_items(target_type, target_unit, item, costs)

                refreshed_source = (
                    _serialize_unit_instance(_get_unit_instance(warband, source_type, source_id), source_type)
                    if source_type != "stash"
                    else None
                )
                refreshed_target = (
                    _serialize_unit_instance(_get_unit_instance(warband, target_type, target_id), target_type)
                    if target_type != "stash"
                    else (WarbandItemSummarySerializer(stash_item).data if stash_item else None)
                )

                return Response(
                    _build_item_change_response(
                        warband,
                        source=refreshed_source,
                        target=refreshed_target,
                        stash_item=stash_item,
                        removed_stash_item_id=removed_stash_item_id,
                    )
                )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)


class WarbandItemSaleView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        serializer = WarbandItemSaleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item_id = serializer.validated_data["item_id"]
        quantity = serializer.validated_data["quantity"]
        price = serializer.validated_data["price"]
        item = Item.objects.filter(id=item_id).first()
        if not item:
            return Response({"detail": "Item not found"}, status=404)

        source_type = serializer.validated_data["source_type"]
        source_id = serializer.validated_data.get("source_id")

        try:
            with transaction.atomic():
                stash_item = None
                removed_stash_item_id = None
                if source_type == "stash":
                    _costs, stash_item = _remove_stash_items(warband, item_id, quantity)
                    if stash_item is None:
                        removed_stash_item_id = item_id
                    refreshed_source = WarbandItemSummarySerializer(stash_item).data if stash_item else None
                else:
                    source_unit = _get_unit_instance(warband, source_type, source_id)
                    if not source_unit:
                        return Response({"detail": "Source not found"}, status=404)
                    _remove_unit_items(source_type, source_unit, item_id, quantity)
                    refreshed_source = _serialize_unit_instance(
                        _get_unit_instance(warband, source_type, source_id),
                        source_type,
                    )

                TradeHelper.create_trade(
                    warband=warband,
                    action="Sold",
                    description=f"{item.name} x {quantity}" if quantity > 1 else item.name,
                    price=price,
                    notes="",
                )

                return Response(
                    _build_item_change_response(
                        warband,
                        source=refreshed_source,
                        stash_item=stash_item,
                        removed_stash_item_id=removed_stash_item_id,
                    )
                )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)


class WarbandLogListView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        logs = WarbandLog.objects.filter(warband=warband)
        feature = request.query_params.get("feature")
        if feature:
            logs = logs.filter(feature__iexact=feature.strip())

        serializer = WarbandLogSerializer(logs.order_by("-created_at"), many=True)
        return Response(serializer.data)

    def post(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        serializer = WarbandLogCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        feature = serializer.validated_data.get("feature") or "trade"
        entry_type = serializer.validated_data.get("entry_type") or "summary"
        payload = serializer.validated_data.get("payload") or {}

        if not payload:
            return Response({"detail": "Payload is required"}, status=400)

        log_entry = log_warband_event(
            warband.id,
            feature,
            entry_type,
            payload,
        )

        return Response(WarbandLogSerializer(log_entry).data, status=status.HTTP_201_CREATED)


class WarbandResourceListCreateView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        resources = WarbandResource.objects.filter(warband=warband).order_by("name")
        serializer = WarbandResourceSerializer(resources, many=True)
        return Response(serializer.data)

    def post(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        serializer = WarbandResourceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        name = serializer.validated_data["name"]
        if WarbandResource.objects.filter(warband=warband, name__iexact=name).exists():
            return Response({"detail": "Resource already exists"}, status=400)
        resource = WarbandResource.objects.create(warband=warband, name=name, amount=0)
        return Response(WarbandResourceSerializer(resource).data, status=status.HTTP_201_CREATED)


class WarbandResourceDetailView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, warband_id, resource_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        resource = WarbandResource.objects.filter(id=resource_id, warband=warband).first()
        if not resource:
            return Response({"detail": "Not found"}, status=404)

        serializer = WarbandResourceUpdateSerializer(resource, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(WarbandResourceSerializer(resource).data)

    def delete(self, request, warband_id, resource_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        resource = WarbandResource.objects.filter(id=resource_id, warband=warband).first()
        if not resource:
            return Response({"detail": "Not found"}, status=404)

        resource.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WarbandTradeListCreateView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        trades = (
            WarbandTrade.objects.filter(warband=warband, parent__isnull=True)
            .prefetch_related("children")
            .order_by("-created_at")
        )
        serializer = WarbandTradeSerializer(trades, many=True)
        return Response(serializer.data)

    def post(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        serializer = WarbandTradeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        parent_id = serializer.validated_data.get("parent_id")
        parent = None
        if parent_id:
            parent = WarbandTrade.objects.filter(id=parent_id, warband=warband).first()

        trade = TradeHelper.create_trade(
            warband=warband,
            action=serializer.validated_data["action"],
            description=serializer.validated_data["description"],
            price=serializer.validated_data.get("price", 0),
            notes=serializer.validated_data.get("notes", ""),
            parent=parent,
        )
        return Response(WarbandTradeSerializer(trade).data, status=status.HTTP_201_CREATED)


class WarbandRestrictionsView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        serializer = RestrictionSerializer(get_effective_restrictions_for_warband(warband), many=True)
        return Response(serializer.data)

    def put(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        serializer = RestrictionSerializer(get_effective_restrictions_for_warband(warband), many=True)
        return Response(serializer.data)
