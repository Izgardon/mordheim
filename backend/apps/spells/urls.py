from django.urls import path

from .views import SpellDetailView, SpellListView

urlpatterns = [
    path("spells/", SpellListView.as_view(), name="spells"),
    path("spells/<int:spell_id>/", SpellDetailView.as_view(), name="spell-detail"),
]
