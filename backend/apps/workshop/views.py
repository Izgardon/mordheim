"""The workshop's routes (docs/plans/workshop.md, "API"). Every one takes a signed-in user; a workshop is its
owner's alone (another user's answers 404), a code anyone's. Views parse, check and call a service."""

from typing import Any

from rest_framework import permissions, status
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from apps.campaigns.views.base import AnswersRefusals, CampaignScopedView
from apps.warbands.services.roster_cost import roster_values

from .serializers import CodeSerializer, ListWorkshopSerializer, WarbandWorkshopSerializer
from .services import importing, reads
from .services.importing import Imported


def made(imported: Imported) -> dict[str, Any]:
    """A new workshop as `GET workshop/` lists it, with the warnings its making left."""
    workshop = imported.workshop
    assert workshop is not None
    if imported.warband is not None:
        value = roster_values([imported.warband])[imported.warband.pk]
        row = reads.warband_row(workshop, imported.warband, value)
    else:
        row = reads.list_row(workshop, imported.template)
    return {**row, "kind": workshop.holds, "warnings": imported.warnings}


class SignedIn(AnswersRefusals):
    permission_classes = [permissions.IsAuthenticated]


class WorkshopListView(SignedIn):
    """GET: my workshops, `{warbands, lists}`."""

    def get(self, request: Request) -> Response:
        return Response(reads.mine(request.user))


class WarbandWorkshopView(SignedIn):
    """POST: a new warband workshop and its warband."""

    def post(self, request: Request) -> Response:
        body = WarbandWorkshopSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        return Response(made(importing.make_warband_workshop(request.user, body.validated_data)), status=201)


class ListWorkshopView(SignedIn):
    """POST: a new list workshop and its template."""

    def post(self, request: Request) -> Response:
        body = ListWorkshopSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        return Response(made(importing.make_list_workshop(request.user, body.validated_data)), status=201)


class WorkshopDetailView(SignedIn):
    """DELETE: my workshop, soft deleted (its code stops working; copies stay). Anyone else's: 404."""

    def delete(self, request: Request, workshop_id: int) -> Response:
        workshop = reads.owned_by(request.user).filter(pk=workshop_id).first()
        if workshop is None:
            raise NotFound("Not found")
        reads.delete(workshop)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SharedView(SignedIn):
    """GET: what a code shares, for anyone signed in."""

    def get(self, request: Request, code: str) -> Response:
        return Response(reads.preview(code))


class ImportIntoWorkshopView(SignedIn):
    """POST {code}: what a code shares, copied into a new workshop of my own."""

    def post(self, request: Request) -> Response:
        body = CodeSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        return Response(made(importing.import_into_workshop(request.user, body.validated_data["code"])), status=201)


class CampaignWarbandImportView(CampaignScopedView):
    """POST {code}: a member with no warband here imports a shared warband as his, paying its cost (a workshop or
    an archived campaign refuses, as every campaign write does)."""

    rules = {"POST": "view"}

    def post(self, request: Request, campaign_id: int) -> Response:
        body = CodeSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        code = body.validated_data["code"]
        imported = importing.import_warband(self.access.campaign, request.user, code, self.access.has("edit_catalogue"))
        assert imported.warband is not None
        answer = {
            "warband_id": imported.warband.pk,
            "template_id": imported.template.pk if imported.template else None,
            "gold": imported.warband.gold,
            "warnings": imported.warnings,
        }
        return Response(answer, status=201)


class CampaignListImportView(CampaignScopedView):
    """POST {code}: a shared list imported as the campaign's own template (`edit_catalogue`)."""

    rules = {"POST": "edit_catalogue"}

    def post(self, request: Request, campaign_id: int) -> Response:
        body = CodeSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        imported = importing.import_list(self.access.campaign, request.user, body.validated_data["code"])
        assert imported.template is not None
        answer = {"template_id": imported.template.pk, "name": imported.template.name, "warnings": imported.warnings}
        return Response(answer, status=201)
