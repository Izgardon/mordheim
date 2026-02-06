from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.permissions import get_membership

from django.db.models import Prefetch

from apps.items.models import Item
from apps.logs.utils import log_warband_event
from apps.warbands.models import Hero, Warband, WarbandItem, WarbandLog, WarbandResource, WarbandTrade
from apps.warbands.permissions import CanEditWarband, CanViewWarband
from apps.warbands.serializers import (
    ItemSummarySerializer,
    WarbandCreateSerializer,
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
from apps.campaigns.models import CampaignSettings
from apps.warbands.utils.trades import TradeHelper

from .mixins import WarbandObjectMixin


class WarbandListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        campaign_id = request.query_params.get("campaign_id")
        warbands = Warband.objects.filter(user=request.user).prefetch_related("resources")

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

        warband = serializer.save(user=request.user)
        WarbandResource.objects.get_or_create(
            warband=warband, name="Treasure", defaults={"amount": 0}
        )
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
        extra_prefetch = [
            Prefetch(
                "heroes",
                queryset=Hero.objects.select_related("race")
                .prefetch_related(
                    "hero_items__item",
                    "skills",
                    "features",
                    "spells",
                )
                .order_by("id"),
            )
        ]
        warband, error_response = self.get_warband_or_404(warband_id, extra_prefetch)
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

        items = warband.items.order_by("name", "id")
        serializer = ItemSummarySerializer(items, many=True)
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
        item_reason = request.data.get("item_reason") or request.data.get("reason")
        item_action = request.data.get("item_action") or request.data.get("action")
        action_text = str(item_action).strip().lower() if item_action is not None else ""
        is_acquired = action_text == "acquired"
        reason_text = str(item_reason).strip() if item_reason is not None else ""
        try:
            item_id = int(item_id)
        except (TypeError, ValueError):
            return Response({"detail": "Invalid item id"}, status=400)

        item = Item.objects.filter(id=item_id).first()
        if not item:
            return Response({"detail": "Item not found"}, status=404)

        _, created = WarbandItem.objects.get_or_create(warband=warband, item=item)
        if not created:
            return Response({"detail": "Item already in stash"}, status=400)

        warband_name = warband.name or "Warband"
        if is_acquired and not reason_text:
            reason_text = "No reason given"
        if is_acquired:
            summary = f"{warband_name} acquired: {item.name}."
            payload = {
                "warband": warband_name,
                "item": item.name,
                "reason": reason_text,
                "summary": f"{summary} (Reason: {reason_text})",
            }
        else:
            summary = f"{warband_name} gained a {item.name}"
            payload = {
                "warband": warband_name,
                "item": item.name,
                "summary": summary,
            }
            if reason_text:
                summary = f"{summary} (Reason: {reason_text})"
                payload["reason"] = reason_text
                payload["summary"] = summary
        log_warband_event(
            warband.id,
            "loadout",
            "hero",
            payload,
        )

        return Response(ItemSummarySerializer(item).data, status=status.HTTP_201_CREATED)


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

        trades = WarbandTrade.objects.filter(warband=warband).order_by("-created_at")
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
        trade = TradeHelper.create_trade(
            warband=warband,
            action=serializer.validated_data["action"],
            description=serializer.validated_data["description"],
            price=serializer.validated_data.get("price", 0),
            notes=serializer.validated_data.get("notes", ""),
        )
        return Response(WarbandTradeSerializer(trade).data, status=status.HTTP_201_CREATED)
