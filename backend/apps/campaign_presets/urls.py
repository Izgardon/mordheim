from django.urls import path

from .views import CampaignPresetListView, CampaignPresetView

urlpatterns = [
    path("campaign-presets/", CampaignPresetListView.as_view(), name="campaign-presets"),
    path("campaigns/<int:campaign_id>/preset/", CampaignPresetView.as_view(), name="campaigns-preset"),
]
