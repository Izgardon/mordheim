from apps.core.catalogue.kinds import SKILLS
from apps.core.catalogue.views import CatalogueDetailView, CatalogueListView


class SkillListView(CatalogueListView):
    kind = SKILLS


class SkillDetailView(CatalogueDetailView):
    kind = SKILLS
