"""The campaign's resources, by name: what a hire fee or upkeep may pick its one resource from (William, 7 Nov 2026)."""

from rest_framework.response import Response

from ..services.resources import campaign_resources
from .base import CampaignScopedView


class CampaignResourcesView(CampaignScopedView):
    """GET: the default resource, campaign points while on, then the other names its warbands' counters hold."""

    rules = {"GET": "view"}

    def get(self, request, campaign_id):
        return Response(campaign_resources(campaign_id))
