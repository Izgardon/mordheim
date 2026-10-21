from django.urls import path

from apps.core.catalogue.kinds import BESTIARY, HIRED_SWORDS
from apps.core.catalogue.routes import entry_actions

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
    *entry_actions("bestiary", BESTIARY, "bestiary"),
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
    *entry_actions("hired-swords", HIRED_SWORDS, "hired-sword-profile"),
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
