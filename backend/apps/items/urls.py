from django.urls import path

from apps.core.catalogue.kinds import ITEMS
from apps.core.catalogue.routes import entry_actions

from .views import ItemDetailView, ItemListView, ItemPropertyDetailView, ItemPropertyListView

urlpatterns = [
    path("items/", ItemListView.as_view(), name="items"),
    path("items/<int:item_id>/", ItemDetailView.as_view(), name="item-detail"),
    *entry_actions("items", ITEMS, "item"),
    path("item-properties/", ItemPropertyListView.as_view(), name="item-properties"),
    path(
        "item-properties/<int:property_id>/",
        ItemPropertyDetailView.as_view(),
        name="item-property-detail",
    ),
]
