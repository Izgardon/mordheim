from django.urls import path

from apps.core.catalogue.kinds import WARBAND_TEMPLATES
from apps.core.catalogue.routes import entry_actions

from .views import WarbandTemplateDetailView, WarbandTemplateListView

urlpatterns = [
    path("warband-templates/", WarbandTemplateListView.as_view(), name="warband-template-list"),
    path("warband-templates/<int:template_id>/", WarbandTemplateDetailView.as_view(), name="warband-template-detail"),
    *entry_actions("warband-templates", WARBAND_TEMPLATES, "warband-template"),
]
