"""The scenarios' routes: the catalogue's (apps/core/catalogue/views.py) and the campaign's own list of them.

`GET campaigns/<id>/scenarios/` is the campaign's list, each row with its weight and its scenario whole, for every
member; `POST` adds a scenario from the catalogue (the book's or the campaign's own, as the campaign's current entry
for it) at a weight, 1 unless sent. `PATCH`/`DELETE .../<row>/` weight a row or take it off the list. Writes take
`manage_scenarios` (owners and admins hold it); an archived campaign is read only. `POST .../random/ {players}`
draws one by weight among the rows that fit the battle (any member: starting a battle is every member's).
"""

from decimal import Decimal
from typing import Any

from django.db import transaction
from django.http.response import HttpResponseBase
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from apps.campaigns.views.base import CampaignScopedView
from apps.core.catalogue.kinds import SCENARIOS
from apps.core.catalogue.scope import refuse_unknown
from apps.core.catalogue.views import CatalogueCollectionView, CatalogueEntryView
from apps.core.errors import ApiError
from apps.realtime.services import sender_socket_id

from .models import CampaignScenario, Scenario
from .serializers import AddScenarioInput, CampaignScenarioSerializer, DrawInput, WeightInput
from .services import campaign_list
from .services.draw import draw, players_for
from .wording import none_fits

WRITE = "manage_scenarios"


class ScenarioListView(CatalogueCollectionView):
    kind = SCENARIOS
    rules = {"GET": "view", "POST": "edit_catalogue"}

    def get(self, request: Request) -> HttpResponseBase:
        return self.list(request)

    def post(self, request: Request) -> Response:
        return self.create(request)


class ScenarioDetailView(CatalogueEntryView):
    kind = SCENARIOS
    rules = {"GET": "view", "PATCH": "edit_catalogue", "DELETE": "delete_catalogue"}

    def get(self, request: Request, **kwargs: Any) -> Response:
        return self.read()

    def patch(self, request: Request, **kwargs: Any) -> Response:
        return self.edit(partial=True)

    def delete(self, request: Request, **kwargs: Any) -> Response:
        return self.destroy()


def _row(row: CampaignScenario) -> dict[str, Any]:
    return dict(CampaignScenarioSerializer(row).data)


class CampaignScenariosView(CampaignScopedView):
    """GET: the campaign's list. POST {scenario_id, weight?}: a scenario joins it."""

    rules = {"GET": "view", "POST": WRITE}

    def get(self, request: Request, campaign_id: int) -> Response:
        return Response([_row(row) for row in campaign_list.campaign_rows(campaign_id)])

    def post(self, request: Request, campaign_id: int) -> Response:
        payload = AddScenarioInput(data=request.data)
        payload.is_valid(raise_exception=True)
        sent = payload.validated_data["scenario_id"]
        with transaction.atomic():
            # the book's scenarios and the campaign's own, each as the campaign's current entry for it (SEC-07)
            current = refuse_unknown(Scenario.objects.all(), [sent], campaign_id)
            weight = payload.validated_data.get("weight", Decimal(1))
            row = campaign_list.add_scenario(campaign_id, current[sent], weight, sender_socket_id(request))
        row = campaign_list.campaign_rows(campaign_id).get(pk=row.pk)
        return Response(_row(row), status=status.HTTP_201_CREATED)


class CampaignScenarioView(CampaignScopedView):
    """PATCH {weight}: the row's weight. DELETE: off the list."""

    rules = {"PATCH": WRITE, "DELETE": WRITE}

    def row(self, campaign_id: int, row_id: int) -> CampaignScenario:
        found = campaign_list.campaign_rows(campaign_id).filter(pk=row_id).first()
        if found is None:
            raise NotFound("Not found")
        return found

    def patch(self, request: Request, campaign_id: int, row_id: int) -> Response:
        payload = WeightInput(data=request.data)
        payload.is_valid(raise_exception=True)
        row = self.row(campaign_id, row_id)
        campaign_list.set_weight(row, payload.validated_data["weight"], sender_socket_id(request))
        return Response(_row(row))

    def delete(self, request: Request, campaign_id: int, row_id: int) -> Response:
        campaign_list.remove(self.row(campaign_id, row_id), sender_socket_id(request))
        return Response(status=status.HTTP_204_NO_CONTENT)


class RandomScenarioView(CampaignScopedView):
    """POST {players: the number of warbands}: a scenario drawn by weight among those that fit, or 400
    `no_scenario_fits`."""

    rules = {"POST": "view"}

    def post(self, request: Request, campaign_id: int) -> Response:
        payload = DrawInput(data=request.data)
        payload.is_valid(raise_exception=True)
        warbands = payload.validated_data["players"]
        drawn = draw(campaign_id, warbands)
        if drawn is None:
            raise ApiError(none_fits(players_for(warbands)), code="no_scenario_fits", status=400)
        return Response(_row(drawn))
