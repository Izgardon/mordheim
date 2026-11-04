from apps.core.catalogue.kinds import SKILL_GROUPS, SKILLS
from apps.core.catalogue.views import CatalogueDetailView, CatalogueListView


class SkillListView(CatalogueListView):
    kind = SKILLS


class SkillDetailView(CatalogueDetailView):
    kind = SKILLS


class SkillGroupListView(CatalogueListView):
    kind = SKILL_GROUPS


class SkillGroupDetailView(CatalogueDetailView):
    kind = SKILL_GROUPS
