"""One set of views for heroes, henchmen groups and hired swords; `unit_urlpatterns` binds them per kind."""

from collections.abc import Callable
from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from apps.warbands.serializers import UNIT_SERIALIZERS
from apps.warbands.views.base import WarbandScopedView

from .kinds import UnitKindSpec
from .serializers import UnitLevelUpSerializer, UnitSerializers
from .services.level_up import LevelUpRejected, apply_advance

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

    def detail_response(self, unit_id: int, **response: Any) -> Response:
        """The unit's detail payload, read once with the shared detail prefetch (PERF-23)."""
        unit = self.kind.detail_queryset().get(id=unit_id)
        return Response(self.serializers.detail(unit).data, **response)


class UnitLevelUpView(UnitView):
    def post(self, request: Request, warband_id: int, **kwargs: Any) -> Response:
        unit = self.kind.objects.filter(id=self.unit_id(kwargs), warband=self.warband).first()  # dead ones too
        if unit is None:
            return Response(NOT_FOUND, status=404)
        serializer = UnitLevelUpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            apply_advance(self.kind, self.warband, unit, serializer.validated_data.get("payload") or {})
        except LevelUpRejected as rejected:
            return Response({"detail": rejected.detail}, status=400)
        return self.detail_response(unit.id)
