"""One set of views for heroes, henchmen groups and hired swords; each is bound per kind in urls.py."""

from collections.abc import Callable
from typing import Any

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.warbands.models import not_dismissed
from apps.warbands.serializers import UNIT_SERIALIZERS
from apps.warbands.views.base import WarbandScopedView

from .kinds import UnitKindSpec
from .serializers import UnitLevelUpSerializer, UnitSerializers
from .services.create import create_unit
from .services.dismiss import dismiss_unit
from .services.kill_history import kill_history
from .services.level_up import LevelUpRejected, apply_advance
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
