from django.urls import path

from apps.core.catalogue.kinds import PLOTS
from apps.core.catalogue.routes import entry_actions

from .views import CampaignPlotsView, PlotDetailView, PlotListView

urlpatterns = [
    path("plots/", PlotListView.as_view(), name="plot-list"),
    path("plots/<int:plot_id>/", PlotDetailView.as_view(), name="plot-detail"),
    *entry_actions("plots", PLOTS, "plot"),
    path("campaigns/<int:campaign_id>/plots/", CampaignPlotsView.as_view(), name="campaigns-plots"),
]
