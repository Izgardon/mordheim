"""The base of every view under warbands/<warband_id>/ (design 0.29, IMP-25)."""

from collections.abc import Mapping
from typing import Any

from rest_framework import permissions
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.campaigns.errors import CampaignArchived
from apps.campaigns.models import CampaignMembership
from apps.campaigns.permissions import get_membership
from apps.realtime.services import send_warband_changed, sender_socket_id
from apps.warbands.access import WARBAND_RULES, warband_capabilities
from apps.warbands.models import Warband


class WarbandScopedView(APIView):
    """Loads the warband and the viewer's membership once and checks the method's rule before the handler.

    Answers as the hand-written checks did: anonymous 401, an unknown warband or a non-member 404 "Not
    found", a write to a warband of an archived campaign 403 `campaign_archived` (decision 5), a member without
    the right 403 "Forbidden", all before the handler looks anything else up.
    Methods the view doesn't handle, and OPTIONS, are left to DRF (405 and the metadata), as before.
    """

    permission_classes = [permissions.IsAuthenticated]
    rules: Mapping[str, str] = {"GET": "view", "POST": "edit", "PUT": "edit", "PATCH": "edit", "DELETE": "edit"}

    warband: Warband
    membership: CampaignMembership

    def initial(self, request: Request, *args: Any, **kwargs: Any) -> None:
        super().initial(request, *args, **kwargs)  # authentication and IsAuthenticated (401) first
        method = "GET" if request.method == "HEAD" else str(request.method)
        if method == "OPTIONS" or not hasattr(self, method.lower()):
            return
        warband = (
            Warband.objects.select_related("campaign", "campaign__settings").filter(id=kwargs["warband_id"]).first()
        )
        if warband is None:
            raise NotFound("Not found")
        membership = get_membership(request.user, warband.campaign_id)
        if membership is None:
            raise NotFound("Not found")
        self.warband, self.membership = warband, membership
        if method != "GET" and warband.campaign.archived_at is not None:
            raise CampaignArchived()
        if not WARBAND_RULES[self.rules[method]](request.user, warband, membership):
            raise PermissionDenied("Forbidden")

    def capabilities(self) -> dict[str, bool]:
        return warband_capabilities(self.request.user, self.warband, self.membership)

    def announce_change(self) -> None:
        """`warband.changed` to the campaign's other members once the write commits, so their open page of this
        warband reads it again (not to the writer's socket, which has the answer)."""
        send_warband_changed(self.warband.campaign_id, self.warband.id, sender_socket_id(self.request))
