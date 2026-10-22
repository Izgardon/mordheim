from django.urls import path

from apps.core.catalogue.kinds import DRAMATIS_PERSONAE, HIRED_SWORDS
from apps.core.catalogue.routes import entry_actions

from .views import DramatisPersonaDetailView, DramatisPersonaListView, HiredSwordDetailView, HiredSwordListView

urlpatterns = [
    path("hired-swords/", HiredSwordListView.as_view(), name="hired-sword-list"),
    path("hired-swords/<int:hired_sword_id>/", HiredSwordDetailView.as_view(), name="hired-sword-detail"),
    *entry_actions("hired-swords", HIRED_SWORDS, "hired-sword"),
    path("dramatis-personae/", DramatisPersonaListView.as_view(), name="dramatis-persona-list"),
    path(
        "dramatis-personae/<int:dramatis_persona_id>/",
        DramatisPersonaDetailView.as_view(),
        name="dramatis-persona-detail",
    ),
    *entry_actions("dramatis-personae", DRAMATIS_PERSONAE, "dramatis-persona"),
]
