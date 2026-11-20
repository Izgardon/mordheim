"""The presets' routes: the dropdown's list, and one campaign's preset.

`GET campaign-presets/` is book data, as `GET settings/` is: a login is all it takes. `GET campaigns/<id>/preset/`
is what the campaign's Settings page shows: what the preset dictates, and where the campaign departs from it.

Changing which preset a campaign plays is the campaign PATCH's `preset_id` (`edit_settings`, the owner), and the
swap rides that one request (William, 20 Nov 2026: "When changing campaign it should swap the rules then and
there"). There is no route to ask for a preset's rules separately: the dialog that confirms the change says what
it will take out, and the change does it.
"""

from rest_framework import permissions
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.views.base import CampaignScopedView

from .payload import campaign_preset_payload
from .selectors import chart_names, preset_rows
from .serializers import CampaignPresetSerializer


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
