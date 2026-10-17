from django.urls import URLPattern, path

from .kinds import UnitKindSpec
from .views import UnitDetailListView, UnitDetailView, UnitKillHistoryView, UnitLevelUpView, UnitListCreateView


def unit_urlpatterns(kind: UnitKindSpec) -> list[URLPattern]:
    """The kind's five roster endpoints, with the paths, URL kwargs and URL names they have always had."""
    segment, unit = kind.url_segment, f"<int:{kind.url_kwarg}>"
    base = f"warbands/<int:warband_id>/{segment}/"
    return [
        path(base, UnitListCreateView.for_kind(kind), name=f"warbands-{segment}"),
        path(f"{base}detail/", UnitDetailListView.for_kind(kind), name=f"warbands-{segment}-detail-list"),
        path(f"{base}{unit}/", UnitDetailView.for_kind(kind), name=f"warbands-{segment}-detail"),
        path(
            f"{base}{unit}/kill-history/",
            UnitKillHistoryView.for_kind(kind),
            name=f"warbands-{segment}-kill-history",
        ),
        path(f"{base}{unit}/level-up/", UnitLevelUpView.for_kind(kind), name=f"warbands-{segment}-level-up"),
    ]
