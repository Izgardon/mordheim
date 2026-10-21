"""The routes every catalogue entry has besides its detail, for each kind: `<prefix>/<id>/revert/` (decisions 1 and
2). Each is the generic view given the kind, so a kind can't miss one."""

from django.urls import URLPattern, path

from .kinds import CatalogueKindSpec
from .views import CatalogueEntryView, CatalogueRevertView

ENTRY_ACTIONS: tuple[tuple[str, type[CatalogueEntryView]], ...] = (("revert", CatalogueRevertView),)


def _for_kind(view: type[CatalogueEntryView], kind: CatalogueKindSpec) -> type[CatalogueEntryView]:
    """The generic view given the kind, as a subclass (as each app's own views are)."""
    named: type[CatalogueEntryView] = type(f"{view.__name__}For{kind.key.title()}", (view,), {"kind": kind})
    return named


def entry_actions(prefix: str, kind: CatalogueKindSpec, name: str) -> list[URLPattern]:
    """`prefix` is the kind's path ("items"), `name` its detail route's name without "-detail" ("item")."""
    return [
        path(f"{prefix}/<int:{kind.url_kwarg}>/{action}/", _for_kind(view, kind).as_view(), name=f"{name}-{action}")
        for action, view in ENTRY_ACTIONS
    ]
