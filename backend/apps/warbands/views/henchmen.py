from rest_framework import permissions, status
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.logs.utils import log_warband_event
from apps.warbands.models import HenchmenGroup
from apps.warbands.utils.trades import TradeHelper
from apps.warbands.permissions import CanEditWarband, CanViewWarband
from apps.warbands.serializers import (
    HenchmenGroupCreateSerializer,
    HenchmenGroupDetailSerializer,
    HenchmenLevelUpLogSerializer,
    HenchmenGroupSummarySerializer,
    HenchmenGroupUpdateSerializer,
)

from .mixins import WarbandObjectMixin


def _parse_henchman_cost(value):
    if value is None:
        return None
    try:
        numeric = int(float(value))
    except (TypeError, ValueError):
        return None
    return max(numeric, 0)


def _calculate_henchman_hire_cost(group: HenchmenGroup) -> int:
    base_cost = group.price or 0
    xp_cost = (group.xp or 0) * 2
    items_cost = sum((item.cost or 0) for item in group.items.all())
    return base_cost + items_cost + xp_cost


class WarbandHenchmenGroupListCreateView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        groups = (
            HenchmenGroup.objects.filter(warband=warband)
            .select_related("race")
            .prefetch_related(
                "henchmen_group_items__item",
                "henchmen_group_skills__skill",
                "henchmen_group_specials__special",
                "henchmen",
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

        serializer = HenchmenGroupCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = serializer.save(warband=warband)
        log_warband_event(
            warband.id,
            "personnel",
            "new_henchmen_group",
            {"name": group.name or "Unknown", "type": group.unit_type or "Unknown"},
        )
        group_name = group.name or group.unit_type or "Unknown Group"
        for henchman in group.henchmen.all():
            henchman_name = henchman.name or "Unnamed Henchman"
            log_warband_event(
                warband.id,
                "personnel",
                "new_henchman",
                {"name": henchman_name, "group": group_name},
            )
        if group.price and group.price > 0:
            for henchman in group.henchmen.all():
                henchman_name = henchman.name or "Unnamed Henchman"
                TradeHelper.create_trade(
                    warband=warband,
                    action="Recruited",
                    description=f"{henchman_name} into {group_name}",
                    price=group.price,
                    notes="",
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
            HenchmenGroup.objects.filter(warband=warband)
            .select_related("race")
            .prefetch_related(
                "henchmen_group_items__item__property_links__property",
                "henchmen_group_skills__skill",
                "henchmen_group_specials__special",
                "henchmen",
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
            HenchmenGroup.objects.filter(id=group_id, warband=warband)
            .select_related("race")
            .prefetch_related(
                "henchmen_group_items__item__property_links__property",
                "henchmen_group_skills__skill",
                "henchmen_group_specials__special",
                "henchmen",
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
            HenchmenGroup.objects.filter(id=group_id, warband=warband)
            .select_related("race")
            .prefetch_related(
                "henchmen_group_items__item__property_links__property",
                "henchmen_group_skills__skill",
                "henchmen_group_specials__special",
                "henchmen",
            )
            .first()
        )
        if not group:
            return Response({"detail": "Not found"}, status=404)

        serializer = HenchmenGroupUpdateSerializer(group, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        henchmen_payload = request.data.get("henchmen")
        if isinstance(henchmen_payload, list):
            existing_ids = set(group.henchmen.values_list("id", flat=True))
            new_henchmen_entries = []
            for entry in henchmen_payload:
                if not isinstance(entry, dict):
                    continue
                entry_id = entry.get("id")
                try:
                    entry_id = int(entry_id) if entry_id is not None else None
                except (TypeError, ValueError):
                    entry_id = None
                if entry_id and entry_id in existing_ids:
                    continue
                new_henchmen_entries.append(entry)

            if new_henchmen_entries:
                group_name = group.name or group.unit_type or "Unknown Group"
                default_cost = _calculate_henchman_hire_cost(group)
                for entry in new_henchmen_entries:
                    henchman_name = entry.get("name") or "Unnamed Henchman"
                    entry_cost = _parse_henchman_cost(entry.get("cost"))
                    hire_cost = entry_cost if entry_cost is not None else default_cost
                    log_warband_event(
                        warband.id,
                        "personnel",
                        "new_henchman",
                        {"name": henchman_name, "group": group_name},
                    )
                    TradeHelper.create_trade(
                        warband=warband,
                        action="Recruited",
                        description=f"{henchman_name} into {group_name}",
                        price=hire_cost,
                        notes="",
                    )

        return Response(HenchmenGroupDetailSerializer(group).data)

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

        group = (
            HenchmenGroup.objects.filter(id=group_id, warband=warband)
            .select_related("race")
            .prefetch_related(
                "henchmen_group_items__item__property_links__property",
                "henchmen_group_skills__skill",
                "henchmen_group_specials__special",
                "henchmen",
            )
            .first()
        )
        if not group:
            return Response({"detail": "Not found"}, status=404)

        serializer = HenchmenLevelUpLogSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data.get("payload") or {}

        current_level_ups = group.level_up or 0
        if current_level_ups <= 0:
            return Response({"detail": "No level ups available"}, status=400)

        advance = payload.get("advance", {})
        advance_id = advance.get("id") if isinstance(advance, dict) else None
        stat_field = self.STAT_MAP.get(advance_id)
        if not stat_field:
            return Response({"detail": "Invalid advance"}, status=400)

        current_value = getattr(group, stat_field, 0) or 0
        new_value = min(10, current_value + 1)
        setattr(group, stat_field, new_value)

        advance_label = None
        if isinstance(advance, dict):
            advance_label = advance.get("label")
        if not isinstance(advance_label, str) or not advance_label.strip():
            advance_label = self.STAT_LABELS.get(advance_id, advance_id)

        history = list(group.level_up_history or [])
        history.append(
            {
                "code": advance_id,
                "label": advance_label,
                "timestamp": timezone.now().isoformat(),
            }
        )
        group.level_up_history = history
        group.level_up = max(0, current_level_ups - 1)
        group.save(update_fields=[stat_field, "level_up", "level_up_history"])

        log_warband_event(warband.id, "advance", "henchmen", payload)

        group.refresh_from_db()
        return Response(HenchmenGroupDetailSerializer(group).data)
