from django.urls import path

from .views import FeatureDetailView, FeatureListView

urlpatterns = [
    path("features/", FeatureListView.as_view(), name="features"),
    path("features/<int:feature_id>/", FeatureDetailView.as_view(), name="feature-detail"),
]

