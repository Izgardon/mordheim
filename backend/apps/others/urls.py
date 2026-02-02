from django.urls import path

from .views import OtherDetailView, OtherListView

urlpatterns = [
    path("others/", OtherListView.as_view(), name="others"),
    path("others/<int:other_id>/", OtherDetailView.as_view(), name="other-detail"),
]
