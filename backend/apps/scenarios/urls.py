from django.urls import path

from apps.core.catalogue.kinds import SCENARIOS
from apps.core.catalogue.routes import entry_actions

from .views import (
    CampaignScenariosView,
    CampaignScenarioView,
    RandomScenarioView,
    ScenarioDetailView,
    ScenarioListView,
)

urlpatterns = [
    path("scenarios/", ScenarioListView.as_view(), name="scenario-list"),
    path("scenarios/<int:scenario_id>/", ScenarioDetailView.as_view(), name="scenario-detail"),
    *entry_actions("scenarios", SCENARIOS, "scenario"),
    path("campaigns/<int:campaign_id>/scenarios/", CampaignScenariosView.as_view(), name="campaign-scenarios"),
    path(
        "campaigns/<int:campaign_id>/scenarios/random/",
        RandomScenarioView.as_view(),
        name="campaign-scenarios-random",
    ),
    path(
        "campaigns/<int:campaign_id>/scenarios/<int:row_id>/",
        CampaignScenarioView.as_view(),
        name="campaign-scenario",
    ),
]
