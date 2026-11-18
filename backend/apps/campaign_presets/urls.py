from django.urls import path

from .views import CampaignPresetListView, CampaignPresetRulesView, CampaignPresetView

urlpatterns = [
    path("campaign-presets/", CampaignPresetListView.as_view(), name="campaign-presets"),
    path("campaigns/<int:campaign_id>/preset/", CampaignPresetView.as_view(), name="campaigns-preset"),
    path("campaigns/<int:campaign_id>/preset/rules/", CampaignPresetRulesView.as_view(), name="campaigns-preset-rules"),
]
