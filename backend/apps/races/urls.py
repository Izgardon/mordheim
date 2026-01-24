from django.urls import path

from .views import RaceDetailView, RaceListView

urlpatterns = [
    path("races/", RaceListView.as_view(), name="races"),
    path("races/<int:race_id>/", RaceDetailView.as_view(), name="race-detail"),
]
