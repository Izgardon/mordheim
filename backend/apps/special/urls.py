from django.urls import path

from .views import SpecialDetailView, SpecialListView

urlpatterns = [
    path("special/", SpecialListView.as_view(), name="special"),
    path("special/<int:special_id>/", SpecialDetailView.as_view(), name="special-detail"),
]
