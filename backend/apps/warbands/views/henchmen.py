from decimal import Decimal

from django.db import transaction
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.logs.utils import log_warband_event
from apps.warbands.models import HenchmenGroup
from apps.warbands.permissions import CanEditWarband, CanViewWarband
from apps.warbands.prefetches import (
    HENCHMEN_GROUP_DETAIL_PREFETCH,
    HENCHMEN_GROUP_SUMMARY_PREFETCH,
    alive_henchmen_prefetch,
    henchmen_group_detail_queryset,
)
from apps.warbands.serializers import (
    HenchmenGroupCreateSerializer,
    HenchmenGroupDetailSerializer,
    HenchmenGroupSummarySerializer,
    HenchmenGroupUpdateSerializer,
    HenchmenLevelUpLogSerializer,
)
from apps.warbands.services.level_up import advance_record, spend_level_up
from apps.warbands.utils.trades import TradeHelper

from .mixins import WarbandObjectMixin


def _parse_henchman_cost(value):
    if value is None:
        return None
    try:
        numeric = int(float(value))
    except (TypeError, ValueError):
        return None
    return max(numeric, 0)


def _calculate_henchman_hire_cost(group: HenchmenGroup) -> int | Decimal:
    base_cost = group.price or 0
    xp_cost = (group.xp or 0) * 2
    items_cost = sum((hgi.cost or 0) for hgi in group.henchmen_group_items.all())
    return base_cost + items_cost + xp_cost


def _record_recruits(warband, group: HenchmenGroup, new_henchmen_entries) -> None:
    """Write the recruit trade and log for every member a group PATCH added.

    `new_henchmen_entries` are the entries the member sync created. An entry naming any existing
    member, dead ones too, is never a recruit (BUG-92); ids are matched as ints (BUG-93).
    """
    group_name = group.name or group.unit_type or "Unknown Group"
    default_cost = _calculate_henchman_hire_cost(group)
    count = len(new_henchmen_entries)

    trade_header = None
    log_header = None
    if count > 1:
        trade_header = TradeHelper.create_group_header(
            warband=warband,
            description=f"Recruited {count} into {group_name}",
        )
        log_header = log_warband_event(
            warband.id,
            "personnel",
            "new_henchmen_group_batch",
            {"name": group_name, "count": count},
        )

    for entry in new_henchmen_entries:
        henchman_name = entry.get("name") or "Unnamed Henchman"
        entry_cost = _parse_henchman_cost(entry.get("cost"))
        hire_cost = entry_cost if entry_cost is not None else default_cost
        item_notes = str(entry.get("item_notes") or "")
        log_warband_event(
            warband.id,
            "personnel",
            "new_henchman",
            {"name": henchman_name, "group": group_name},
            parent_id=log_header.id if log_header else None,
        )
        TradeHelper.create_trade(
            warband=warband,
            action="Recruited",
            description=f"{henchman_name} into {group_name}",
            price=hire_cost,
            notes=item_notes,
            parent=trade_header,
        )


class WarbandHenchmenGroupListCreateView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        groups = (
            HenchmenGroup.objects.filter(warband=warband, dead=False)
            .select_related("race")
            .prefetch_related(
                *HENCHMEN_GROUP_SUMMARY_PREFETCH,
                alive_henchmen_prefetch(),
            )
            .order_by("id")
        )
        serializer = HenchmenGroupSummarySerializer(groups, many=True)
        return Response(serializer.data)

    def post(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        serializer = HenchmenGroupCreateSerializer(data=request.data, context={"campaign_id": warband.campaign_id})
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            group = serializer.save(warband=warband)
            log_warband_event(
                warband.id,
                "personnel",
                "new_henchmen_group",
                {"name": group.name or "Unknown", "type": group.unit_type or "Unknown"},
            )
            group_name = group.name or group.unit_type or "Unknown Group"
            henchmen_list = list(group.henchmen.all())
            count = len(henchmen_list)

            trade_header = None
            log_header = None
            if count > 1:
                trade_header = TradeHelper.create_group_header(
                    warband=warband,
                    description=f"Recruited {count} {group_name}",
                )
                log_header = log_warband_event(
                    warband.id,
                    "personnel",
                    "new_henchmen_group_batch",
                    {"name": group_name, "count": count},
                )

            for henchman in henchmen_list:
                henchman_name = henchman.name or "Unnamed Henchman"
                log_warband_event(
                    warband.id,
                    "personnel",
                    "new_henchman",
                    {"name": henchman_name, "group": group_name},
                    parent_id=log_header.id if log_header else None,
                )
            if group.price and group.price > 0:
                item_notes = str(request.data.get("item_notes") or "")
                for henchman in henchmen_list:
                    henchman_name = henchman.name or "Unnamed Henchman"
                    TradeHelper.create_trade(
                        warband=warband,
                        action="Recruited",
                        description=f"{henchman_name} into {group_name}",
                        price=group.price,
                        notes=item_notes,
                        parent=trade_header,
                    )
        return Response(
            HenchmenGroupDetailSerializer(group).data,
            status=status.HTTP_201_CREATED,
        )


class WarbandHenchmenGroupDetailListView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        groups = (
            HenchmenGroup.objects.filter(warband=warband, dead=False)
            .select_related("race")
            .prefetch_related(
                *HENCHMEN_GROUP_DETAIL_PREFETCH,
                alive_henchmen_prefetch(),
            )
            .order_by("id")
        )
        return Response(HenchmenGroupDetailSerializer(groups, many=True).data)


class WarbandHenchmenGroupDetailView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id, group_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        group = (
            HenchmenGroup.objects.filter(id=group_id, warband=warband, dead=False)
            .select_related("race")
            .prefetch_related(
                *HENCHMEN_GROUP_DETAIL_PREFETCH,
                alive_henchmen_prefetch(),
            )
            .first()
        )
        if not group:
            return Response({"detail": "Not found"}, status=404)

        return Response(HenchmenGroupDetailSerializer(group).data)

    def patch(self, request, warband_id, group_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        group = (
            HenchmenGroup.objects.filter(id=group_id, warband=warband, dead=False)
            .select_related("warband__campaign__settings")
            .first()
        )
        if not group:
            return Response({"detail": "Not found"}, status=404)

        serializer = HenchmenGroupUpdateSerializer(
            group, data=request.data, partial=True, context={"campaign_id": warband.campaign_id}
        )
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            serializer.save()
            if serializer.recruited_entries:
                _record_recruits(warband, group, serializer.recruited_entries)

        # One read with the detail prefetch, so the response lists living members like GET (PERF-23).
        return Response(HenchmenGroupDetailSerializer(henchmen_group_detail_queryset().get(id=group.id)).data)

    def delete(self, request, warband_id, group_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        group = HenchmenGroup.objects.filter(id=group_id, warband=warband).first()
        if not group:
            return Response({"detail": "Not found"}, status=404)

        group_name = group.name or "Unknown"
        group_type = group.unit_type or "Unknown"
        with transaction.atomic():
            log_warband_event(
                warband.id,
                "personnel",
                "remove_henchmen_group",
                {"name": group_name, "type": group_type},
            )
            group.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WarbandHenchmenGroupLevelUpView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    STAT_MAP = {
        "WS": "weapon_skill",
        "BS": "ballistic_skill",
        "S": "strength",
        "I": "initiative",
        "A": "attacks",
        "Ld": "leadership",
    }
    STAT_LABELS = {
        "WS": "Weapon Skill",
        "BS": "Ballistic Skill",
        "S": "Strength",
        "I": "Initiative",
        "A": "Attack",
        "Ld": "Leadership",
    }

    def post(self, request, warband_id, group_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        group = HenchmenGroup.objects.filter(id=group_id, warband=warband).first()
        if not group:
            return Response({"detail": "Not found"}, status=404)

        serializer = HenchmenLevelUpLogSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data.get("payload") or {}

        if group.no_level_ups or (group.level_up or 0) <= 0:
            return Response({"detail": "No level ups available"}, status=400)

        advance = payload.get("advance", {})
        advance_id = advance.get("id") if isinstance(advance, dict) else None
        if not isinstance(advance_id, str) or advance_id not in self.STAT_MAP:
            return Response({"detail": "Invalid advance"}, status=400)

        with transaction.atomic():
            record = advance_record(advance, self.STAT_LABELS)
            if not spend_level_up(group, stat_field=self.STAT_MAP[advance_id], record=record):
                return Response({"detail": "No level ups available"}, status=400)
            log_warband_event(warband.id, "advance", "henchmen", payload)

        return Response(HenchmenGroupDetailSerializer(henchmen_group_detail_queryset().get(id=group.id)).data)
