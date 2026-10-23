from django.urls import path

from apps.core.catalogue.kinds import SPECIALS
from apps.core.catalogue.routes import entry_actions

from .views import SpecialDetailView, SpecialListView

urlpatterns = [
    path("special/", SpecialListView.as_view(), name="special"),
    path("special/<int:special_id>/", SpecialDetailView.as_view(), name="special-detail"),
    *entry_actions("special", SPECIALS, "special"),
]
