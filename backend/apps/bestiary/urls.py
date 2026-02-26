from django.urls import path

from .views import (
    BestiaryEntryDetailView,
    BestiaryEntryListView,
    HiredSwordProfileDetailView,
    HiredSwordProfileListView,
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
        "hired-swords/",
        HiredSwordProfileListView.as_view(),
        name="hired-sword-profile-list",
    ),
    path(
        "hired-swords/<int:profile_id>/",
        HiredSwordProfileDetailView.as_view(),
        name="hired-sword-profile-detail",
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
