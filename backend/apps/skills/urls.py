from django.urls import path

from apps.core.catalogue.kinds import SKILL_GROUPS, SKILLS
from apps.core.catalogue.routes import entry_actions

from .views import SkillDetailView, SkillGroupDetailView, SkillGroupListView, SkillListView

urlpatterns = [
    path("skills/", SkillListView.as_view(), name="skills"),
    path("skills/<int:skill_id>/", SkillDetailView.as_view(), name="skill-detail"),
    *entry_actions("skills", SKILLS, "skill"),
    path("skill-groups/", SkillGroupListView.as_view(), name="skill-groups"),
    path("skill-groups/<int:group_id>/", SkillGroupDetailView.as_view(), name="skill-group-detail"),
    *entry_actions("skill-groups", SKILL_GROUPS, "skill-group"),
]
