from django.urls import path

from .views import (
    HeroOtherDetailView,
    HeroSpellDetailView,
    WarbandDetailView,
    WarbandHeroDetailView,
    WarbandHeroDetailListView,
    WarbandHeroListCreateView,
    WarbandItemListView,
    WarbandListCreateView,
    WarbandLogListView,
    WarbandResourceDetailView,
    WarbandResourceListCreateView,
    WarbandSummaryView,
)

urlpatterns = [
    path("warbands/", WarbandListCreateView.as_view(), name="warbands"),
    path("warbands/<int:warband_id>/", WarbandDetailView.as_view(), name="warbands-detail"),
    path(
        "warbands/<int:warband_id>/summary/",
        WarbandSummaryView.as_view(),
        name="warbands-summary",
    ),
    path(
        "warbands/<int:warband_id>/items/",
        WarbandItemListView.as_view(),
        name="warbands-items",
    ),
    path(
        "warbands/<int:warband_id>/heroes/",
        WarbandHeroListCreateView.as_view(),
        name="warbands-heroes",
    ),
    path(
        "warbands/<int:warband_id>/heroes/detail/",
        WarbandHeroDetailListView.as_view(),
        name="warbands-heroes-detail-list",
    ),
    path(
        "warbands/<int:warband_id>/heroes/<int:hero_id>/",
        WarbandHeroDetailView.as_view(),
        name="warbands-heroes-detail",
    ),
    path(
        "warbands/hero-others/<int:other_id>/",
        HeroOtherDetailView.as_view(),
        name="warbands-hero-other-detail",
    ),
    path(
        "warbands/hero-spells/<int:spell_id>/",
        HeroSpellDetailView.as_view(),
        name="warbands-hero-spell-detail",
    ),
    path(
        "warbands/<int:warband_id>/logs/",
        WarbandLogListView.as_view(),
        name="warbands-logs",
    ),
    path(
        "warbands/<int:warband_id>/resources/",
        WarbandResourceListCreateView.as_view(),
        name="warbands-resources",
    ),
    path(
        "warbands/<int:warband_id>/resources/<int:resource_id>/",
        WarbandResourceDetailView.as_view(),
        name="warbands-resources-detail",
    ),
]
