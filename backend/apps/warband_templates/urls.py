from django.urls import path

from apps.core.catalogue.kinds import WARBAND_TEMPLATES
from apps.core.catalogue.routes import entry_actions

from . import editor_views
from .views import WarbandTemplateDetailView, WarbandTemplateListView

ONE = "warband-templates/<int:template_id>"

urlpatterns = [
    path("warband-templates/", WarbandTemplateListView.as_view(), name="warband-template-list"),
    path(f"{ONE}/", WarbandTemplateDetailView.as_view(), name="warband-template-detail"),
    *entry_actions("warband-templates", WARBAND_TEMPLATES, "warband-template"),
    path(f"{ONE}/editor/", editor_views.TemplateEditorView.as_view(), name="warband-template-editor"),
    path(f"{ONE}/who-can/", editor_views.TemplateWhoCanView.as_view(), name="warband-template-who-can"),
    path(f"{ONE}/basics/", editor_views.BasicsView.as_view(), name="warband-template-basics"),
    path(f"{ONE}/fighters/", editor_views.FightersView.as_view(), name="warband-template-fighters"),
    path(f"{ONE}/fighters/<slug:fighter_key>/", editor_views.FighterView.as_view(), name="warband-template-fighter"),
    path(f"{ONE}/lists/", editor_views.ListsView.as_view(), name="warband-template-lists"),
    path(f"{ONE}/lists/<slug:list_key>/", editor_views.ListView.as_view(), name="warband-template-list-entry"),
    path(f"{ONE}/rules/", editor_views.RulesView.as_view(), name="warband-template-rules"),
    path(f"{ONE}/upgrades/", editor_views.UpgradesView.as_view(), name="warband-template-upgrades"),
]
