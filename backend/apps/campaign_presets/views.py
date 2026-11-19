"""The presets' routes: the dropdown's list, and one campaign's preset with its rules offer.

`GET campaign-presets/` is book data, as `GET settings/` is: a login is all it takes. `GET campaigns/<id>/preset/`
is what the campaign's Settings page shows (what the preset dictates, where the campaign departs from it and which
of its rules it lacks), and `POST campaigns/<id>/preset/rules/` adds the rules it lacks — never silently, and never
twice. Changing which preset a campaign plays is the campaign PATCH's `preset_id` (`edit_settings`, the owner).
"""

from django.db import transaction
from rest_framework import permissions
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.serializers.charts import CampaignChartSerializer
from apps.campaigns.serializers.content import CampaignRuleSerializer
from apps.campaigns.services.campaign_charts import campaign_charts
from apps.campaigns.services.campaign_rules import campaign_rules
from apps.campaigns.views.base import CampaignScopedView

from .payload import campaign_preset_payload
from .selectors import chart_names, preset_of, preset_rows
from .serializers import CampaignPresetSerializer
from .services.charts import copy_charts
from .services.rules import copy_rules


class CampaignPresetListView(APIView):
    """GET campaign-presets/: every published campaign a campaign may play, in the dropdown's order, each with the
    settings it guides towards and what it dictates. Book data, so a login is all it takes. Three queries."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request) -> Response:
        presets = list(preset_rows())
        context = {"chart_names": chart_names(presets)}
        return Response(CampaignPresetSerializer(presets, many=True, context=context).data)


class CampaignPresetView(CampaignScopedView):
    """GET campaigns/<id>/preset/: which published campaign it plays, what that preset dictates, where the campaign
    departs from it and which of its rules the campaign lacks."""

    rules = {"GET": "view"}

    def get(self, request: Request, campaign_id: int) -> Response:
        return Response(campaign_preset_payload(self.access.campaign))


class CampaignPresetRulesView(CampaignScopedView):
    """POST campaigns/<id>/preset/rules/: add the preset's rules and charts the campaign holds none of by title, in
    the preset's order (its owner and admins, as the campaign's own rules are theirs). Answers the campaign's rules
    and charts as they now stand."""

    rules = {"POST": "manage_campaign_rules"}

    def post(self, request: Request, campaign_id: int) -> Response:
        campaign = self.access.campaign
        with transaction.atomic():
            preset = preset_of(campaign)
            copy_rules(campaign, preset)
            copy_charts(campaign, preset)
        return Response(
            {
                "rules": CampaignRuleSerializer(campaign_rules(campaign_id), many=True).data,
                "charts": CampaignChartSerializer(campaign_charts(campaign_id), many=True).data,
            }
        )
