"""One set of views for heroes, henchmen groups and hired swords; each is bound per kind in urls.py."""

from collections.abc import Callable, Iterable
from typing import Any

from django.db import transaction
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.items.models import Item
from apps.warbands.models import Henchman, HenchmanItemGap, not_dismissed, on_roster
from apps.warbands.serializers import UNIT_SERIALIZERS, WarbandItemSummarySerializer, WarbandSummarySerializer
from apps.warbands.serializers.beasts import BackToItemSerializer
from apps.warbands.services.stash import stash_entry
from apps.warbands.utils.leaders import lock_warband
from apps.warbands.views.base import WarbandScopedView
from apps.warbands.views.beasts import back_to_item_answer

from .errors import validation_error
from .kinds import HERO, UnitKindSpec
from .serializers import (
    AdvancePickSerializer,
    CompanionSwitchSerializer,
    GapActionSerializer,
    HenchmanPromoteSerializer,
    HireSerializer,
    UnitBatchSerializer,
    UnitLevelUpSerializer,
    UnitSerializers,
)
from .services.advance_picks import advance_with_pick, pick_later
from .services.back_to_item import back_to_item
from .services.batch import apply_batch, plan_batch
from .services.companions import loaded_unit_warnings, switch_companion
from .services.create import create_unit
from .services.dismiss import dismiss_unit
from .services.hire import catalogue_entry, custom_payload, hire, hire_payload, hire_terms
from .services.kill_history import kill_history
from .services.level_up import LevelUpRejected, apply_advance
from .services.members import fill_gap, on_roster_gap, take_kit
from .services.promote import promote_henchman
from .services.update import update_unit

NOT_FOUND = {"detail": "Not found"}


class UnitView(WarbandScopedView):
    kind: UnitKindSpec  # bound per kind by for_kind()

    @classmethod
    def for_kind(cls, kind: UnitKindSpec) -> Callable[..., Any]:
        """This view for one kind, named as the per-kind view it replaces (e.g. WarbandHeroLevelUpView)."""
        name = cls.__name__.replace("Unit", f"Warband{kind.model.__name__}", 1)
        view_class: type[UnitView] = type(name, (cls,), {"kind": kind, "__doc__": None})
        return view_class.as_view()

    @property
    def serializers(self) -> UnitSerializers:
        return UNIT_SERIALIZERS[self.kind.key]

    def unit_id(self, kwargs: dict[str, Any]) -> int:
        return int(kwargs[self.kind.url_kwarg])

    def kept_unit(self, kwargs: dict[str, Any]) -> Any:
        """The URL's unit if it is still in this warband (dead or alive), else None: a dismissed unit has left."""
        return not_dismissed(self.kind.objects.filter(id=self.unit_id(kwargs), warband=self.warband)).first()

    def detail_response(self, unit_id: int, **response: Any) -> Response:
        """The unit's detail payload, read once with the shared detail prefetch (PERF-23)."""
        unit = self.kind.detail_queryset().get(id=unit_id)
        return Response(self.serializers.detail(unit).data, **response)


class UnitListCreateView(UnitView):
    def get(self, request: Request, warband_id: int) -> Response:
        units = self.kind.roster(self.warband, detail=False)
        return Response(self.serializers.summary(units, many=True).data)

    def post(self, request: Request, warband_id: int) -> Response:
        writer = self.serializers.create(data=request.data, context={"campaign_id": self.warband.campaign_id})
        writer.is_valid(raise_exception=True)
        unit = create_unit(self.kind, self.warband, writer, sent=request.data)
        return self.detail_response(unit.pk, status=status.HTTP_201_CREATED)


class UnitDetailListView(UnitView):
    def get(self, request: Request, warband_id: int) -> Response:
        units = self.kind.roster(self.warband, detail=True)
        return Response(self.serializers.detail(units, many=True).data)


class UnitDetailView(UnitView):
    def get(self, request: Request, warband_id: int, **kwargs: Any) -> Response:
        units = self.kind.detail_queryset().filter(id=self.unit_id(kwargs), warband=self.warband)
        unit = self.kind.visible(units).first()
        if unit is None:
            return Response(NOT_FOUND, status=404)
        return Response(self.serializers.detail(unit).data)

    def patch(self, request: Request, warband_id: int, **kwargs: Any) -> Response:
        units = self.kind.objects.filter(id=self.unit_id(kwargs), warband=self.warband)
        unit = self.kind.visible(units).select_related("warband__campaign__settings").first()
        if unit is None:
            return Response(NOT_FOUND, status=404)
        context = {"campaign_id": self.warband.campaign_id}
        writer = self.serializers.update(unit, data=request.data, partial=True, context=context)
        writer.is_valid(raise_exception=True)
        update_unit(self.kind, self.warband, writer, sent=request.data)
        return self.detail_response(unit.id)

    def delete(self, request: Request, warband_id: int, **kwargs: Any) -> Response:
        unit = self.kept_unit(kwargs)  # dead ones too
        if unit is None:
            return Response(NOT_FOUND, status=404)
        dismiss_unit(self.kind, self.warband, unit)
        return Response(status=status.HTTP_204_NO_CONTENT)


class UnitLevelUpView(UnitView):
    def post(self, request: Request, warband_id: int, **kwargs: Any) -> Response:
        unit = self.kept_unit(kwargs)  # dead ones too
        if unit is None:
            return Response(NOT_FOUND, status=404)
        serializer = UnitLevelUpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload, pick = serializer.validated_data.get("payload") or {}, serializer.validated_data.get("pick")
        try:
            if pick:
                advance_with_pick(self.kind, self.warband, unit, payload, pick)
            else:
                apply_advance(self.kind, self.warband, unit, payload)
        except LevelUpRejected as rejected:
            return Response({"detail": rejected.detail}, status=400)
        return self.detail_response(unit.id)


class UnitPickView(UnitView):
    """POST .../pick/: a pick an advance left for later ("Skill to choose"), made from the card's guided picker."""

    def post(self, request: Request, warband_id: int, **kwargs: Any) -> Response:
        unit = self.kept_unit(kwargs)
        if unit is None:
            return Response(NOT_FOUND, status=404)
        serializer = AdvancePickSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                pick_later(self.kind, self.warband, unit, dict(serializer.validated_data))
        except LevelUpRejected as rejected:
            return Response({"detail": rejected.detail}, status=400)
        return self.detail_response(unit.id)


class UnitKillHistoryView(UnitView):
    def get(self, request: Request, warband_id: int, **kwargs: Any) -> Response:
        # dead and dismissed ones too: their kills still count
        unit = self.kind.objects.filter(id=self.unit_id(kwargs), warband=self.warband).first()
        if unit is None:
            return Response(NOT_FOUND, status=404)
        return Response(kill_history(self.kind, self.warband, unit))


# Lad's Got Talent, henchmen groups only (decision 9, BUG-28). No docstring: DRF serves it on OPTIONS.
class UnitPromoteView(UnitView):
    def post(self, request: Request, warband_id: int, **kwargs: Any) -> Response:
        units = self.kind.objects.filter(id=self.unit_id(kwargs), warband=self.warband)
        group = self.kind.visible(units).select_related("race").first()
        if group is None:
            return Response(NOT_FOUND, status=404)
        body = HenchmanPromoteSerializer(data=request.data)
        if not body.is_valid():
            raise validation_error(body.errors)
        promotion = promote_henchman(self.warband, group, body.validated_data)
        hero = HERO.detail_queryset().get(id=promotion.hero.pk)
        kept = self.kind.detail_queryset().get(id=group.pk) if promotion.group else None
        payload = {
            "hero": UNIT_SERIALIZERS[HERO.key].detail(hero).data,
            "group": self.serializers.detail(kept).data if kept else None,
            "summary": WarbandSummarySerializer(self.warband).data,
        }
        return Response(payload, status=status.HTTP_201_CREATED)


# The recruit queue's Save (decision 1). No docstring: DRF serves it on OPTIONS.
class UnitBatchView(UnitView):
    def post(self, request: Request, warband_id: int) -> Response:
        shape = UnitBatchSerializer(data=request.data)
        if not shape.is_valid():
            raise validation_error(shape.errors)
        plan = plan_batch(self.kind, self.serializers, self.warband, shape.validated_data)
        warnings = apply_batch(self.kind, self.warband, plan)
        units = self.kind.roster(self.warband, detail=True)
        payload = {
            "units": self.serializers.detail(units, many=True).data,
            "summary": WarbandSummarySerializer(self.warband).data,
            "warnings": warnings,
        }
        return Response(payload)


# The bestiary rewrite: a hired sword or dramatis persona copied from the catalogue, or one typed by hand (`custom`),
# paying what the request says (the fees and skill lists step; hirelings only). No docstring: DRF serves it on OPTIONS.
class UnitHireView(UnitView):
    def post(self, request: Request, warband_id: int) -> Response:
        body = HireSerializer(data=request.data)
        if not body.is_valid():
            raise validation_error(body.errors)
        sent, campaign_id = body.validated_data, self.warband.campaign_id
        entry = None if sent["source"] == "custom" else catalogue_entry(sent["source"], sent["id"], campaign_id)
        if entry is None:
            terms = hire_terms(sent, {}, sent.get("name") or sent.get("unit_type") or "")
            payload = custom_payload(sent, terms)
        else:
            terms = hire_terms(sent, entry.hire_fee, sent.get("name") or entry.name)
            payload = hire_payload(sent["source"], entry, sent.get("name"), terms.gold)
        writer = self.serializers.create(data=payload, context={"campaign_id": campaign_id})
        writer.is_valid(raise_exception=True)
        hired = hire(self.warband, writer, sent["source"], entry, terms)
        unit = self.kind.detail_queryset().get(id=hired.unit.pk)
        return Response(
            {**self.serializers.detail(unit).data, "warnings": hired.warnings}, status=status.HTTP_201_CREATED
        )


# The bestiary rewrite step 4: a mount or pet in the unit's items switched on or off for him (only the unit holding the
# item). No docstring: DRF serves it on OPTIONS.
class UnitItemCompanionView(UnitView):
    def post(self, request: Request, warband_id: int, **kwargs: Any) -> Response:
        unit = self.kind.visible(self.kind.objects.filter(id=self.unit_id(kwargs), warband=self.warband)).first()
        if unit is None:
            return Response(NOT_FOUND, status=404)
        body = CompanionSwitchSerializer(data=request.data)
        if not body.is_valid():
            raise validation_error(body.errors)
        switch_companion(self.kind, unit, int(kwargs["item_row_id"]), body.validated_data["on"])
        loaded = self.kind.detail_queryset().get(id=unit.pk)
        payload = {
            "unit": self.serializers.detail(loaded).data,
            "summary": WarbandSummarySerializer(self.warband).data,
            "warnings": loaded_unit_warnings(self.kind, self.warband, loaded),
        }
        return Response(payload)


# The bestiary rewrite step 4: members of a group recruited from a creature back to its item, in the stash (henchmen
# groups only). No docstring: DRF serves it on OPTIONS.
class UnitBackToItemView(UnitView):
    def post(self, request: Request, warband_id: int, **kwargs: Any) -> Response:
        group = self.kind.visible(self.kind.objects.filter(id=self.unit_id(kwargs), warband=self.warband)).first()
        if group is None:
            return Response(NOT_FOUND, status=404)
        body = BackToItemSerializer(data=request.data)
        if not body.is_valid():
            raise validation_error(body.errors)
        outcome = back_to_item(self.warband, group, body.validated_data)
        return Response(back_to_item_answer(self.warband, outcome))


def _loadout_answer(view: UnitView, group_id: int, item_ids: Iterable[int]) -> dict[str, Any]:
    """A loadout change's answer: the group, the summary, and each touched item's stash entry (or its id, gone)."""
    items = Item.objects.select_related("bestiary_entry").in_bulk(list(dict.fromkeys(item_ids)))
    stash = {item_id: stash_entry(view.warband.id, item) for item_id, item in items.items()}
    loaded = view.kind.detail_queryset().get(id=group_id)
    return {
        "unit": view.serializers.detail(loaded).data,
        "summary": WarbandSummarySerializer(view.warband).data,
        "stash_items": [WarbandItemSummarySerializer(entry).data for entry in stash.values() if entry is not None],
        "removed_stash_item_ids": [item_id for item_id, entry in stash.items() if entry is None],
    }


# Henchmen loadouts: a member's gap filled (bought, from the stash) or left. No docstring: DRF serves it on OPTIONS.
class UnitGapView(UnitView):
    def post(self, request: Request, warband_id: int, **kwargs: Any) -> Response:
        group = self.kind.visible(self.kind.objects.filter(id=self.unit_id(kwargs), warband=self.warband)).first()
        gaps = HenchmanItemGap.objects.select_related("group_item__item", "henchman")
        gap = on_roster_gap(gaps, group, int(kwargs["gap_id"])) if group is not None else None
        if group is None or gap is None:
            return Response(NOT_FOUND, status=404)
        body = GapActionSerializer(data=request.data)
        if not body.is_valid():
            raise validation_error(body.errors)
        with transaction.atomic():
            lock_warband(self.warband.id)
            fill_gap(self.warband, group, gap, body.validated_data)
        stash_touched = [gap.group_item.item_id] if body.validated_data["action"] == "stash" else []
        return Response(_loadout_answer(self, group.pk, stash_touched))


# Henchmen loadouts: "Take Skritt's kit" to the stash. No docstring: DRF serves it on OPTIONS.
class UnitTakeKitView(UnitView):
    def post(self, request: Request, warband_id: int, **kwargs: Any) -> Response:
        group = self.kind.visible(self.kind.objects.filter(id=self.unit_id(kwargs), warband=self.warband)).first()
        members = on_roster(Henchman.objects.filter(group=group, id=int(kwargs["henchman_id"])))
        member = members.first() if group is not None else None
        if group is None or member is None:
            return Response(NOT_FOUND, status=404)
        with transaction.atomic():
            lock_warband(self.warband.id)
            moved = take_kit(self.warband, group, member)
        return Response(_loadout_answer(self, group.pk, moved))
