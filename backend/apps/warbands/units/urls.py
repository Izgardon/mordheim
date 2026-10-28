from django.urls import URLPattern, path

from .kinds import UnitKindSpec
from .views import (
    UnitBackToItemView,
    UnitBatchView,
    UnitDetailListView,
    UnitDetailView,
    UnitHireView,
    UnitItemCompanionView,
    UnitKillHistoryView,
    UnitLevelUpView,
    UnitListCreateView,
    UnitPromoteView,
)


def unit_urlpatterns(kind: UnitKindSpec) -> list[URLPattern]:
    """The kind's roster endpoints, with the paths, URL kwargs and URL names they have always had.

    Every kind also gets `batch/` (the recruit queue's Save) and `items/<row>/companion/` (a mount or pet switched
    on or off for the unit); kinds with members (henchmen groups) also get `promote/` (Lad's Got Talent) and
    `back-to-item/` (a creature's members back to its item), and hirelings `hire/` (a hired sword or dramatis persona
    from the catalogue).
    """
    segment, unit = kind.url_segment, f"<int:{kind.url_kwarg}>"
    base = f"warbands/<int:warband_id>/{segment}/"
    patterns = [
        path(base, UnitListCreateView.for_kind(kind), name=f"warbands-{segment}"),
        path(f"{base}detail/", UnitDetailListView.for_kind(kind), name=f"warbands-{segment}-detail-list"),
        path(f"{base}batch/", UnitBatchView.for_kind(kind), name=f"warbands-{segment}-batch"),
        path(f"{base}{unit}/", UnitDetailView.for_kind(kind), name=f"warbands-{segment}-detail"),
        path(
            f"{base}{unit}/kill-history/",
            UnitKillHistoryView.for_kind(kind),
            name=f"warbands-{segment}-kill-history",
        ),
        path(f"{base}{unit}/level-up/", UnitLevelUpView.for_kind(kind), name=f"warbands-{segment}-level-up"),
        path(
            f"{base}{unit}/items/<int:item_row_id>/companion/",
            UnitItemCompanionView.for_kind(kind),
            name=f"warbands-{segment}-item-companion",
        ),
    ]
    if kind.has_members:
        patterns.append(
            path(f"{base}{unit}/promote/", UnitPromoteView.for_kind(kind), name=f"warbands-{segment}-promote")
        )
        patterns.append(
            path(
                f"{base}{unit}/back-to-item/",
                UnitBackToItemView.for_kind(kind),
                name=f"warbands-{segment}-back-to-item",
            )
        )
    if kind.hired_from_catalogue:
        patterns.append(path(f"{base}hire/", UnitHireView.for_kind(kind), name=f"warbands-{segment}-hire"))
    return patterns
