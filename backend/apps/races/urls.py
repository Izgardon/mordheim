from django.urls import path

from apps.core.catalogue.kinds import RACES
from apps.core.catalogue.routes import entry_actions

from .views import RaceDetailView, RaceListView

urlpatterns = [
    path("races/", RaceListView.as_view(), name="races"),
    path("races/<int:race_id>/", RaceDetailView.as_view(), name="race-detail"),
    *entry_actions("races", RACES, "race"),
]
