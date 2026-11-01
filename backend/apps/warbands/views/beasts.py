"""Creatures in the warband (the bestiary rewrite step 4): recruited into henchmen from their Animal item, and back.

`POST beasts/recruit/` answers the group, the source the copies left (the unit's detail, or the stash entry left and
the id of a stash entry that emptied), the summary and warnings; `POST henchmen-groups/<id>/back-to-item/`
(units/views.py) answers the group (None once its last member went), the stash entries that changed and the summary.
"""

from typing import Any, cast

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.warbands.models import Warband
from apps.warbands.serializers import UNIT_SERIALIZERS, WarbandItemSummarySerializer, WarbandSummarySerializer
from apps.warbands.serializers.beasts import BeastRecruitSerializer
from apps.warbands.services.stash import stash_entries
from apps.warbands.services.summary import load_warband_units
from apps.warbands.units.errors import validation_error
from apps.warbands.units.kinds import HENCHMEN_GROUP, KINDS, UnitKindKey
from apps.warbands.units.services.back_to_item import BackToItem
from apps.warbands.units.services.beasts import Recruited, recruit_beasts, size_warnings

from .base import WarbandScopedView


def unit_detail(kind_key: str, unit_id: int) -> Any:
    kind = KINDS[cast(UnitKindKey, kind_key)]
    return UNIT_SERIALIZERS[kind.key].detail(kind.detail_queryset().get(id=unit_id)).data


def recruit_answer(warband: Warband, recruited: Recruited) -> dict[str, Any]:
    group = unit_detail(HENCHMEN_GROUP.key, recruited.group.pk)
    units = load_warband_units([warband.id])[warband.id]
    from_stash = recruited.source_unit is None
    return {
        "group": group,
        "source": None if from_stash else unit_detail(recruited.source_type, recruited.source_unit.pk),
        "stash_item": WarbandItemSummarySerializer(recruited.stash).data if recruited.stash else None,
        "removed_stash_item_id": recruited.item.id if from_stash and recruited.stash is None else None,
        "summary": WarbandSummarySerializer(warband, context={"warband_units": units}).data,
        "warnings": size_warnings(warband, group, units),
    }


def back_to_item_answer(warband: Warband, outcome: BackToItem) -> dict[str, Any]:
    landed = {entry.item.id: entry for entry in stash_entries(warband)}
    return {
        "group": unit_detail(HENCHMEN_GROUP.key, outcome.group.pk) if outcome.group else None,
        "stash_items": [WarbandItemSummarySerializer(landed[pk]).data for pk in outcome.item_ids if pk in landed],
        "summary": WarbandSummarySerializer(warband).data,
    }


class WarbandBeastRecruitView(WarbandScopedView):
    """POST beasts/recruit/: copies of a creature's Animal item, from a unit or the stash, become henchmen."""

    def post(self, request: Request, warband_id: int) -> Response:
        body = BeastRecruitSerializer(data=request.data)
        if not body.is_valid():
            raise validation_error(body.errors)
        recruited = recruit_beasts(self.warband, body.validated_data)
        return Response(recruit_answer(self.warband, recruited), status=status.HTTP_201_CREATED)
