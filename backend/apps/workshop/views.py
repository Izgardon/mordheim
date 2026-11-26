"""The workshop's routes (docs/plans/workshop.md, "Version 2 API"). Every one takes a signed-in user; a workshop is
its player's alone (anyone else's reads as not found), a code anyone's. Views parse, check and call a service.

A workshop's warbands and lists are otherwise read and written through the usual routes, with the workshop's id as
their campaign: the warband routes (its DELETE soft deletes one), the catalogue's (his own content and his lists'
Delete) and the template editor's.
"""

from typing import Any

from rest_framework import permissions
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from apps.campaigns.models import CAMPAIGN
from apps.campaigns.views.base import AnswersRefusals, CampaignScopedView
from apps.warband_templates.models import WarbandTemplate
from apps.warbands.models import Warband

from .serializers import CodeSerializer, ListWorkshopSerializer, WarbandWorkshopSerializer
from .services import importing, reads
from .services.importing import Made
from .services.making import workshop_for


def made(found: Made) -> dict[str, Any]:
    """What a making or a copy into the workshop answers: the new warband or list as `GET workshop/` lists it, with
    `kind` and the warnings it left."""
    if found.warband is not None:
        warband = reads.live_warbands().get(pk=found.warband.pk)
        return {**reads.warband_rows([warband])[0], "kind": "warband", "warnings": found.warnings}
    assert found.template is not None
    template = reads.live_lists().get(pk=found.template.pk)
    return {**reads.list_row(template), "kind": "list", "warnings": found.warnings}


class SignedIn(AnswersRefusals):
    permission_classes = [permissions.IsAuthenticated]


class WorkshopView(SignedIn):
    """GET: my workshop, `{id, warbands, lists}` (id null before my first use). POST: my workshop, made now if I have
    none (for my own content before any warband or list)."""

    def get(self, request: Request) -> Response:
        return Response(reads.mine(request.user))

    def post(self, request: Request) -> Response:
        workshop_for(request.user)
        return Response(reads.mine(request.user))


class WarbandWorkshopView(SignedIn):
    """POST: a new warband in my workshop."""

    def post(self, request: Request) -> Response:
        body = WarbandWorkshopSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        return Response(made(importing.make_warband(request.user, body.validated_data)), status=201)


class ListWorkshopView(SignedIn):
    """POST: a new list in my workshop."""

    def post(self, request: Request) -> Response:
        body = ListWorkshopSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        return Response(made(importing.make_list(request.user, body.validated_data)), status=201)


class SharedView(SignedIn):
    """GET: what a code shares, for anyone signed in."""

    def get(self, request: Request, code: str) -> Response:
        return Response(reads.preview(code))


class ImportIntoWorkshopView(SignedIn):
    """POST {code}: what a code shares, copied into my workshop."""

    def post(self, request: Request) -> Response:
        body = CodeSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        return Response(made(importing.import_into_workshop(request.user, body.validated_data["code"])), status=201)


class WarbandToWorkshopView(SignedIn):
    """POST: my warband in a campaign (archived or not) copied into my workshop; anyone else's reads as not found."""

    def post(self, request: Request, warband_id: int) -> Response:
        user: Any = request.user  # signed in (IsAuthenticated)
        rows = Warband.objects.filter(campaign__kind=CAMPAIGN, campaign__deleted_at__isnull=True, user=user)
        source = rows.select_related("warband_type", "campaign").filter(pk=warband_id).first()
        if source is None:
            raise NotFound("Not found")
        return Response(made(importing.warband_to_workshop(request.user, source)), status=201)


class ListToWorkshopView(SignedIn):
    """POST: a campaign's own list (or house version), copied into my workshop by a member of that campaign (archived
    or not); a book template, or one he can't see, reads as not found."""

    def post(self, request: Request, template_id: int) -> Response:
        user: Any = request.user  # signed in (IsAuthenticated)
        rows = WarbandTemplate.objects.filter(
            campaign__kind=CAMPAIGN, campaign__memberships__user=user, archived_at__isnull=True
        )
        source = rows.filter(pk=template_id).first()
        if source is None:
            raise NotFound("Not found")
        return Response(made(importing.list_to_workshop(request.user, source)), status=201)


class CampaignWarbandImportView(CampaignScopedView):
    """POST {code}: a member with no warband here imports a shared warband as his, paying its cost (a workshop or
    an archived campaign refuses, as every campaign write does)."""

    rules = {"POST": "view"}

    def post(self, request: Request, campaign_id: int) -> Response:
        body = CodeSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        code = body.validated_data["code"]
        found = importing.import_warband(self.access.campaign, request.user, code, self.access.has("edit_catalogue"))
        assert found.warband is not None
        answer = {
            "warband_id": found.warband.pk,
            "template_id": found.template.pk if found.template else None,
            "gold": found.warband.gold,
            "warnings": found.warnings,
        }
        return Response(answer, status=201)


class CampaignListImportView(CampaignScopedView):
    """POST {code}: a shared list imported as the campaign's own template (`edit_catalogue`)."""

    rules = {"POST": "edit_catalogue"}

    def post(self, request: Request, campaign_id: int) -> Response:
        body = CodeSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        found = importing.import_list(self.access.campaign, request.user, body.validated_data["code"])
        assert found.template is not None
        answer = {"template_id": found.template.pk, "name": found.template.name, "warnings": found.warnings}
        return Response(answer, status=201)
