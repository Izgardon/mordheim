"""The base of every view under campaigns/<campaign_id>/ (design 0.29, IMP-63)."""

from collections.abc import Mapping
from typing import Any

from rest_framework import permissions
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..access import CAMPAIGN_RULES, CampaignAccess, campaign_capabilities, load_campaign_access
from ..errors import CampaignArchived, CampaignError, Refused


class AnswersRefusals(APIView):
    """A `CampaignError` or `Refused` raised by a campaign service answers itself (standard or older body); the
    service's transaction has already rolled back what it wrote."""

    def handle_exception(self, exc: Exception) -> Response:
        if isinstance(exc, (CampaignError, Refused)):
            return exc.response()
        return super().handle_exception(exc)


class CampaignScopedView(AnswersRefusals):
    """Loads the caller's access once (membership, role, campaign, settings and codes in one query) and checks the
    method's rule before the handler.

    Answers as the hand-written checks did: anonymous 401 (and throttles) first, then a non-member 404 "Not found",
    a feature switched off 404 "Not found" (`feature_flag`), any write to an archived campaign 403
    `campaign_archived` (but the methods in `allow_archived`: restore, delete), a member without the right 403
    "Forbidden". `rules`
    maps each method the view handles to a rule of `access.CAMPAIGN_RULES`; a handled method it doesn't list is
    refused (deny by default). Methods the view doesn't handle, and OPTIONS, are left to DRF (405, metadata).
    Object rules (a note's author) are checked in the handler with `check_rule(name, obj)`.
    """

    permission_classes = [permissions.IsAuthenticated]
    rules: Mapping[str, str] = {"GET": "view"}
    feature_flag: str | None = None
    allow_archived: frozenset[str] = frozenset()  # writes an archived campaign still takes (decision 5)

    access: CampaignAccess

    def initial(self, request: Request, *args: Any, **kwargs: Any) -> None:
        super().initial(request, *args, **kwargs)  # authentication, IsAuthenticated (401) and throttles first
        method = "GET" if request.method == "HEAD" else str(request.method)
        if method == "OPTIONS" or not hasattr(self, method.lower()):
            return
        access = load_campaign_access(request, kwargs["campaign_id"])
        if access is None:
            raise NotFound("Not found")
        self.access = access
        if self.feature_flag and not access.feature(self.feature_flag):
            raise NotFound("Not found")
        if method != "GET" and access.archived and method not in self.allow_archived:
            raise CampaignArchived()
        self.check_rule(self.rules.get(method))

    def check_rule(self, name: str | None, obj: Any = None) -> None:
        """403 "Forbidden" unless the caller passes the rule (for `obj`, for an object rule)."""
        if name is None or not CAMPAIGN_RULES[name](self.access, obj):
            raise PermissionDenied("Forbidden")

    def capabilities(self) -> dict[str, bool]:
        """What the caller may do in the campaign, as flags (access.CAPABILITIES): no query."""
        return campaign_capabilities(self.access)
