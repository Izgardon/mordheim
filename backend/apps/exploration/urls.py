from django.urls import path

from apps.core.catalogue.kinds import EXPLORATION_CHARTS
from apps.core.catalogue.routes import entry_actions

from .views import CampaignExplorationView, ExplorationChartDetailView, ExplorationChartListView

urlpatterns = [
    path("exploration-charts/", ExplorationChartListView.as_view(), name="exploration-chart-list"),
    path(
        "exploration-charts/<int:chart_id>/",
        ExplorationChartDetailView.as_view(),
        name="exploration-chart-detail",
    ),
    *entry_actions("exploration-charts", EXPLORATION_CHARTS, "exploration-chart"),
    path(
        "campaigns/<int:campaign_id>/exploration/",
        CampaignExplorationView.as_view(),
        name="campaigns-exploration",
    ),
]
