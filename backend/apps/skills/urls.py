from django.urls import path

from apps.core.catalogue.kinds import SKILLS
from apps.core.catalogue.routes import entry_actions

from .views import SkillDetailView, SkillListView

urlpatterns = [
    path("skills/", SkillListView.as_view(), name="skills"),
    path("skills/<int:skill_id>/", SkillDetailView.as_view(), name="skill-detail"),
    *entry_actions("skills", SKILLS, "skill"),
]
