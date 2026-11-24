"""A campaign's encampments (William, 24 Nov 2026): every member reads them while the Encampments page is on;
`manage_encampments` adds, edits and removes groups and encampments; a warband's player (or a manager) takes one,
and its holder's player (or a manager) razes it or gives it up. Every write tells the campaign's other members
(`encampments.changed`), and a change of holder the pages of the warbands it touched (`warband.changed`)."""

from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from apps.realtime.services import send_encampments_changed, send_warband_changed, sender_socket_id
from apps.warbands.models import Warband

from ..serializers.content import CampaignRuleSerializer
from ..serializers.encampments import (
    CampaignEncampmentGroupSerializer,
    CampaignEncampmentSerializer,
    CampaignEncampmentWriteSerializer,
    EncampmentTakeSerializer,
)
from ..services import encampment_holding, encampments
from .base import CampaignScopedView

FLAG = "enable_encampments"
WRITE = "manage_encampments"


class EncampmentView(CampaignScopedView):
    feature_flag = FLAG

    def context(self) -> dict:
        """What each encampment's capabilities read: the reader's access, and the warbands he may take one for."""
        manages = self.access.has(WRITE)
        mine = encampments.takers(self.access.campaign_id, self.access.user_id, manages)
        return {"access": self.access, "takers": mine, "taker_ids": {warband.pk for warband in mine}}

    def announce(self, warband_ids: list[int] | None = None) -> None:
        """After commit: the other members' Encampments pages read the list again, and the touched warbands' pages
        their sheets. The writer's own socket is skipped: it has the answer."""
        socket = sender_socket_id(self.request)
        send_encampments_changed(self.access.campaign_id, socket)
        for warband_id in warband_ids or []:
            send_warband_changed(self.access.campaign_id, warband_id, socket)

    def group(self, campaign_id, group_id):
        found = encampments.group_of(campaign_id, group_id)
        if found is None:
            raise NotFound("Not found")
        return found

    def encampment(self, campaign_id, encampment_id):
        found = encampments.encampment_of(campaign_id, encampment_id)
        if found is None:
            raise NotFound("Not found")
        return found

    def group_answer(self, campaign_id, group_id) -> dict:
        group = encampments.encampment_groups(campaign_id).get(id=group_id)
        return dict(CampaignEncampmentGroupSerializer(group, context=self.context()).data)

    def encampment_answer(self, campaign_id, encampment_id) -> dict:
        found = self.encampment(campaign_id, encampment_id)
        return dict(CampaignEncampmentSerializer(found, context=self.context()).data)


class CampaignEncampmentGroupsView(EncampmentView):
    """GET: the encampment rules, the groups in their order with their encampments, and the warbands the reader may
    take one for (his own; every warband for a manager). POST: add a group, last."""

    rules = {"GET": "view", "POST": WRITE}

    def get(self, request, campaign_id):
        context = self.context()
        groups = encampments.encampment_groups(campaign_id)
        rules = encampments.encampment_rules(campaign_id)
        return Response(
            {
                "rules": CampaignRuleSerializer(rules, many=True).data,
                "groups": CampaignEncampmentGroupSerializer(groups, many=True, context=context).data,
                "takers": [
                    {"id": warband.pk, "name": warband.name, "mine": warband.user_id == self.access.user_id}
                    for warband in context["takers"]
                ],
            }
        )

    def post(self, request, campaign_id):
        serializer = CampaignEncampmentGroupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = encampments.create_group(campaign_id, dict(serializer.validated_data))
        self.announce()
        return Response(self.group_answer(campaign_id, group.id), status=status.HTTP_201_CREATED)


class CampaignEncampmentGroupDetailView(EncampmentView):
    """PATCH: its name and description. DELETE: take it and its encampments off the list."""

    rules = {"PATCH": WRITE, "DELETE": WRITE}

    def patch(self, request, campaign_id, group_id):
        group = self.group(campaign_id, group_id)
        serializer = CampaignEncampmentGroupSerializer(group, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        encampments.update_group(group, dict(serializer.validated_data))
        self.announce()
        return Response(self.group_answer(campaign_id, group.id))

    def delete(self, request, campaign_id, group_id):
        encampments.remove_group(self.group(campaign_id, group_id), request.user)
        self.announce()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CampaignEncampmentsView(EncampmentView):
    """POST: add an encampment, last in its group, held by nobody."""

    rules = {"POST": WRITE}

    def post(self, request, campaign_id):
        serializer = CampaignEncampmentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        made = encampments.create_encampment(campaign_id, dict(serializer.validated_data))
        self.announce()
        return Response(self.encampment_answer(campaign_id, made.id), status=status.HTTP_201_CREATED)


class CampaignEncampmentDetailView(EncampmentView):
    """PATCH: the fields sent (never who holds it). DELETE: take it off the list (a soft delete)."""

    rules = {"PATCH": WRITE, "DELETE": WRITE}

    def patch(self, request, campaign_id, encampment_id):
        found = self.encampment(campaign_id, encampment_id)
        serializer = CampaignEncampmentWriteSerializer(found, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        encampments.update_encampment(found, dict(serializer.validated_data))
        self.announce()
        return Response(self.encampment_answer(campaign_id, found.id))

    def delete(self, request, campaign_id, encampment_id):
        found = self.encampment(campaign_id, encampment_id)
        encampments.remove_encampment(found, request.user)
        self.announce([found.holder_id] if found.holder_id else [])
        return Response(status=status.HTTP_204_NO_CONTENT)


class EncampmentTakeView(EncampmentView):
    """POST {warband_id}: the warband holds it now, whoever held it (a warning names the scenario the book has you
    play first). The warband is the caller's own, or he holds manage_encampments."""

    rules = {"POST": "view"}  # then take_encampment for the warband named

    def post(self, request, campaign_id, encampment_id):
        body = EncampmentTakeSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        found = self.encampment(campaign_id, encampment_id)
        warband = Warband.objects.filter(campaign_id=campaign_id, id=body.validated_data["warband_id"]).first()
        if warband is None:
            raise NotFound("Not found")
        self.check_rule("take_encampment", warband)
        change = encampment_holding.take(found, warband)
        self.announce(change.warband_ids)
        answer = self.encampment_answer(campaign_id, found.id)
        return Response({"encampment": answer, "warnings": change.warnings})


class EncampmentRazeView(EncampmentView):
    """POST: razed, held by nobody. Its holder's player, or manage_encampments."""

    rules = {"POST": "view"}  # then change_holding for the encampment

    def post(self, request, campaign_id, encampment_id):
        found = self.encampment(campaign_id, encampment_id)
        self.check_rule("change_holding", found)
        change = encampment_holding.raze(found)
        self.announce(change.warband_ids)
        return Response({"encampment": self.encampment_answer(campaign_id, found.id), "warnings": change.warnings})


class EncampmentGiveUpView(EncampmentView):
    """POST: held by nobody. Its holder's player, or manage_encampments."""

    rules = {"POST": "view"}  # then change_holding for the encampment

    def post(self, request, campaign_id, encampment_id):
        found = self.encampment(campaign_id, encampment_id)
        self.check_rule("change_holding", found)
        change = encampment_holding.give_up(found)
        self.announce(change.warband_ids)
        return Response({"encampment": self.encampment_answer(campaign_id, found.id), "warnings": change.warnings})
