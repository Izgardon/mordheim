from django.urls import URLPattern, path

from .kinds import UnitKindSpec
from .views import (
    UnitBatchView,
    UnitDetailListView,
    UnitDetailView,
    UnitKillHistoryView,
    UnitLevelUpView,
    UnitListCreateView,
    UnitPromoteView,
)


def unit_urlpatterns(kind: UnitKindSpec) -> list[URLPattern]:
    """The kind's roster endpoints, with the paths, URL kwargs and URL names they have always had.

    Every kind also gets `batch/` (the recruit queue's Save); kinds with members (henchmen groups) also
    get `promote/` (Lad's Got Talent).
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
    ]
    if kind.has_members:
        patterns.append(
            path(f"{base}{unit}/promote/", UnitPromoteView.for_kind(kind), name=f"warbands-{segment}-promote")
        )
    return patterns
