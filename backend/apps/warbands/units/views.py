"""One set of views for heroes, henchmen groups and hired swords; each is bound per kind in urls.py."""

from collections.abc import Callable
from typing import Any

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.warbands.models import not_dismissed
from apps.warbands.serializers import UNIT_SERIALIZERS, WarbandSummarySerializer
from apps.warbands.serializers.beasts import BackToItemSerializer
from apps.warbands.views.base import WarbandScopedView
from apps.warbands.views.beasts import back_to_item_answer

from .errors import validation_error
from .kinds import HERO, UnitKindSpec
from .serializers import (
    CompanionSwitchSerializer,
    HenchmanPromoteSerializer,
    HireSerializer,
    UnitBatchSerializer,
    UnitLevelUpSerializer,
    UnitSerializers,
)
from .services.back_to_item import back_to_item
from .services.batch import apply_batch, plan_batch
from .services.companions import loaded_unit_warnings, switch_companion
from .services.create import create_unit
from .services.dismiss import dismiss_unit
from .services.hire import catalogue_entry, hire, hire_payload
from .services.kill_history import kill_history
from .services.level_up import LevelUpRejected, apply_advance
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
        if update_unit(self.kind, self.warband, writer, sent=request.data):
            self.announce_change()  # missing games: other members' open pages of the warband follow
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
        try:
            apply_advance(self.kind, self.warband, unit, serializer.validated_data.get("payload") or {})
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
        if plan.missing_changed:
            self.announce_change()
        units = self.kind.roster(self.warband, detail=True)
        payload = {
            "units": self.serializers.detail(units, many=True).data,
            "summary": WarbandSummarySerializer(self.warband).data,
            "warnings": warnings,
        }
        return Response(payload)


# The bestiary rewrite: a hired sword or dramatis persona copied from the catalogue (hirelings only). No docstring:
# DRF serves it on OPTIONS.
class UnitHireView(UnitView):
    def post(self, request: Request, warband_id: int) -> Response:
        body = HireSerializer(data=request.data)
        if not body.is_valid():
            raise validation_error(body.errors)
        source, campaign_id = body.validated_data["source"], self.warband.campaign_id
        entry = catalogue_entry(source, body.validated_data["id"], campaign_id)
        payload = hire_payload(source, entry, body.validated_data.get("name"))
        writer = self.serializers.create(data=payload, context={"campaign_id": campaign_id})
        writer.is_valid(raise_exception=True)
        hired = hire(self.warband, writer, source, entry)
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
        self.announce_change()
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
        self.announce_change()
        return Response(back_to_item_answer(self.warband, outcome))
