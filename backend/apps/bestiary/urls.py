from django.urls import path

from .views import (
    BestiaryEntryDetailView,
    BestiaryEntryListView,
    WarbandBestiaryFavouriteDeleteView,
    WarbandBestiaryFavouriteListView,
)

urlpatterns = [
    path(
        "bestiary/",
        BestiaryEntryListView.as_view(),
        name="bestiary-list",
    ),
    path(
        "bestiary/<int:entry_id>/",
        BestiaryEntryDetailView.as_view(),
        name="bestiary-detail",
    ),
    path(
        "warbands/<int:warband_id>/bestiary-favourites/",
        WarbandBestiaryFavouriteListView.as_view(),
        name="warband-bestiary-favourites",
    ),
    path(
        "warbands/<int:warband_id>/bestiary-favourites/<int:entry_id>/",
        WarbandBestiaryFavouriteDeleteView.as_view(),
        name="warband-bestiary-favourite-delete",
    ),
]
