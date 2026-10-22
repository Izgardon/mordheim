from django.urls import path

from apps.core.catalogue.kinds import SPELLS
from apps.core.catalogue.routes import entry_actions

from .views import SpellDetailView, SpellListView

urlpatterns = [
    path("spells/", SpellListView.as_view(), name="spells"),
    path("spells/<int:spell_id>/", SpellDetailView.as_view(), name="spell-detail"),
    *entry_actions("spells", SPELLS, "spell"),
]
