from django.urls import path

from .views import ItemDetailView, ItemListView

urlpatterns = [
    path("items/", ItemListView.as_view(), name="items"),
    path("items/<int:item_id>/", ItemDetailView.as_view(), name="item-detail"),
]
