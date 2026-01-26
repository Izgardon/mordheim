from django.urls import path

from .views import (
    WarbandDetailView,
    WarbandHeroDetailView,
    WarbandHeroListCreateView,
    WarbandListCreateView,
    WarbandLogListView,
)

urlpatterns = [
    path("warbands/", WarbandListCreateView.as_view(), name="warbands"),
    path("warbands/<int:warband_id>/", WarbandDetailView.as_view(), name="warbands-detail"),
    path(
        "warbands/<int:warband_id>/heroes/",
        WarbandHeroListCreateView.as_view(),
        name="warbands-heroes",
    ),
    path(
        "warbands/<int:warband_id>/heroes/<int:hero_id>/",
        WarbandHeroDetailView.as_view(),
        name="warbands-heroes-detail",
    ),
    path(
        "warbands/<int:warband_id>/logs/",
        WarbandLogListView.as_view(),
        name="warbands-logs",
    ),
]
