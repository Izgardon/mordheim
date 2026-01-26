from django.urls import path

from .views import SkillDetailView, SkillListView

urlpatterns = [
    path("skills/", SkillListView.as_view(), name="skills"),
    path("skills/<int:skill_id>/", SkillDetailView.as_view(), name="skill-detail"),
]
