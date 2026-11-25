from typing import Any

from django.db import transaction
from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaign_presets.models import CampaignPreset
from apps.campaign_presets.services.resources import give_fixed, other_resources
from apps.campaign_presets.services.warband_rules import copy_warband_rules
from apps.campaigns.models import DEFAULT_RESOURCE_NAME, CampaignSettings
from apps.campaigns.permissions import get_writable_membership, parse_campaign_id
from apps.warband_templates.services.payload import raise_gold
from apps.warband_templates.services.raising import copy_rules, picked_variant, settle_variant
from apps.warband_templates.services.resolve import template_for_type, template_size
from apps.warband_templates.services.rule_swap import RuleSwap, swap_rules
from apps.warbands.access import check_backstory_change
from apps.warbands.models import LedgerAction, Warband, WarbandResource
from apps.warbands.serializers import (
    WarbandCreateSerializer,
    WarbandRuleSerializer,
    WarbandSerializer,
    WarbandSummarySerializer,
    WarbandUpdateSerializer,
)
from apps.warbands.services import ledger
from apps.warbands.services.plot_rules import check_plot, sync_plot_rules
from apps.warbands.services.types import load_types, picked_types

from .base import WarbandScopedView


class WarbandListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        campaign_id = parse_campaign_id(request.query_params.get("campaign_id"))  # garbage is a 400 (BUG-152)
        warbands = Warband.objects.filter(user=request.user).select_related("campaign", "campaign__settings")

        if campaign_id is not None:
            warbands = warbands.filter(campaign_id=campaign_id)

        rows = list(warbands.order_by("created_at"))
        load_types(rows)  # their types, for all of them in one query
        return Response(WarbandSerializer(rows, many=True).data)

    def post(self, request):
        serializer = WarbandCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign_id = serializer.validated_data.get("campaign_id")

        if not get_writable_membership(request.user, campaign_id):
            return Response({"detail": "Not found"}, status=404)

        if Warband.objects.filter(campaign_id=campaign_id, user=request.user).exists():
            return Response({"detail": "Warband already exists"}, status=400)

        counts_as = picked_types(campaign_id, serializer.validated_data) or []  # 400 for a type it may not pick
        check_plot(campaign_id, serializer.validated_data)  # 400 for a plot the campaign doesn't play with
        # its type's template (the templates plan, phase 2): the variant, the most warriors, the gold and its rules
        template = template_for_type(campaign_id, serializer.validated_data["warband_type"].pk)
        variant = picked_variant(template, serializer.validated_data.pop("template_variant", ""))
        if template is not None:
            serializer.validated_data.setdefault("max_units", template_size(template, variant))
        with transaction.atomic():
            # locked: a rename of the default resource reaches this warband too, before or after (one at a time)
            settings = CampaignSettings.objects.select_for_update().filter(campaign_id=campaign_id).first()
            warband = serializer.save(user=request.user, template_variant=variant)
            warband.counts_as.set(counts_as)
            # the one everyone starts with (William, 3 Nov 2026), named as the campaign names it
            name = settings.default_resource_name if settings else DEFAULT_RESOURCE_NAME
            WarbandResource.objects.create(warband=warband, name=name, amount=0, is_default=True)
            # and the counters its campaign's preset keeps for every warband (Marienburg's Wyrdstone)
            preset = CampaignPreset.objects.filter(campaigns__id=campaign_id).first()
            give_fixed([warband], other_resources(preset))
            starting_gold = raise_gold(abs(settings.starting_gold) if settings else 500, template, variant)
            ledger.record(warband, LedgerAction.STARTING_GOLD, starting_gold, "Starting Gold")
            if template is not None:
                copy_rules(warband, template, variant)
            # then its preset's rules for its type or race (William, 23 Nov 2026: Karak Azgal's Dwarf drunks)
            copy_warband_rules(warband, preset.pk if preset else None)
            sync_plot_rules(warband)  # the rungs it has reached, after those rules (apps/plots)
        return Response(WarbandSerializer(warband).data, status=status.HTTP_201_CREATED)


def rules_changed(swap: RuleSwap | None) -> dict[str, Any] | None:
    """What a change of variant or type did to the warband's rules (null: it changed neither): the server's words,
    the counts, the edited rules kept, and its rules as they now stand, for the sheet's pills."""
    if swap is None:
        return None
    return {
        "words": swap.words(),
        "added": len(swap.added),
        "removed": swap.removed,
        "kept": swap.kept,
        "rules": WarbandRuleSerializer(swap.rules, many=True).data,
    }


class WarbandDetailView(WarbandScopedView):
    rules = {**WarbandScopedView.rules, "DELETE": "delete"}  # only the warband's owner may delete it

    def get(self, request: Request, warband_id: int) -> Response:
        return Response(WarbandSerializer(self.warband).data)

    def patch(self, request: Request, warband_id: int) -> Response:
        serializer = WarbandUpdateSerializer(self.warband, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        counts_as = picked_types(self.warband.campaign_id, serializer.validated_data)  # a new type, what it counts as
        settle_variant(self.warband, serializer.validated_data)  # the variant follows a new type (templates plan)
        check_plot(self.warband.campaign_id, serializer.validated_data)
        check_backstory_change(request.user, self.warband, self.membership, serializer.validated_data)
        plotted = {"plot_id", "campaign_points"} & set(serializer.validated_data)
        was = (self.warband.warband_type_id, self.warband.template_variant)
        with transaction.atomic():
            serializer.save()
            if counts_as is not None:
                self.warband.counts_as.set(counts_as)
            if plotted:  # a new plot, or a new total: its plot rules are written again (apps/plots)
                sync_plot_rules(self.warband)
            # a new variant or type swaps the rules it was given for the new ones' (William, 25 Nov 2026)
            swapped = swap_rules(self.warband, *was)
        return Response({**WarbandSerializer(self.warband).data, "rules_changed": rules_changed(swapped)})

    def delete(self, request: Request, warband_id: int) -> Response:
        self.warband.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WarbandSummaryView(WarbandScopedView):
    def get(self, request: Request, warband_id: int) -> Response:
        return Response(WarbandSummarySerializer(self.warband).data)
