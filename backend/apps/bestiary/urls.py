from django.urls import path

from apps.core.catalogue.kinds import BESTIARY
from apps.core.catalogue.routes import entry_actions

from .views import BestiaryEntryDetailView, BestiaryEntryListView

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
]
