"""Campaign content: the bulletin board, encampments, locations and house rules."""

from rest_framework import status
from rest_framework.response import Response

from ..models import CampaignBulletinEntry, CampaignHouseRule, CampaignLocation
from ..serializers.content import (
    CampaignBulletinEntryCreateSerializer,
    CampaignBulletinEntrySerializer,
    CampaignEncampmentSerializer,
    CampaignEncampmentWriteSerializer,
    CampaignHouseRuleCreateSerializer,
    CampaignHouseRuleSerializer,
    CampaignLocationSerializer,
    CampaignLocationWriteSerializer,
)
from ..services import bulletin, encampments, house_rules, locations
from .base import CampaignScopedView


def not_found() -> Response:
    return Response({"detail": "Not found"}, status=404)


class CampaignBulletinView(CampaignScopedView):
    """GET: the notes, newest first. POST: any member adds one (up to 280 characters)."""

    rules = {"GET": "view", "POST": "view"}

    def get(self, request, campaign_id):
        return Response(CampaignBulletinEntrySerializer(bulletin.entries(campaign_id), many=True).data)

    def post(self, request, campaign_id):
        serializer = CampaignBulletinEntryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = bulletin.post(campaign_id, request.user, serializer.validated_data["body"])
        return Response(CampaignBulletinEntrySerializer(entry).data, status=status.HTTP_201_CREATED)


class CampaignBulletinDetailView(CampaignScopedView):
    """DELETE: a note's author deletes it."""

    rules = {"DELETE": "view"}  # then the author, once the note is found

    def delete(self, request, campaign_id, entry_id):
        entry = CampaignBulletinEntry.objects.filter(id=entry_id, campaign_id=campaign_id).first()
        if not entry:
            return not_found()
        self.check_rule("delete_bulletin_entry", entry)
        bulletin.delete(entry)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CampaignEncampmentsView(CampaignScopedView):
    """GET: the encampments. POST: add one (manage_encampments). Both need the Encampments page switched on."""

    feature_flag = "enable_encampments"
    rules = {"GET": "view", "POST": "manage_encampments"}

    def get(self, request, campaign_id):
        return Response(CampaignEncampmentSerializer(encampments.encampments(campaign_id), many=True).data)

    def post(self, request, campaign_id):
        serializer = CampaignEncampmentWriteSerializer(data=request.data, context={"campaign_id": campaign_id})
        serializer.is_valid(raise_exception=True)
        entry = encampments.create(campaign_id, serializer.validated_data)
        return Response(CampaignEncampmentSerializer(entry).data, status=status.HTTP_201_CREATED)


class CampaignEncampmentDetailView(CampaignScopedView):
    """PATCH: edit an encampment (manage_encampments, with the page switched on)."""

    feature_flag = "enable_encampments"
    rules = {"PATCH": "manage_encampments"}

    def patch(self, request, campaign_id, encampment_id):
        entry = encampments.encampments(campaign_id).filter(id=encampment_id).first()
        if not entry:
            return not_found()
        serializer = CampaignEncampmentWriteSerializer(
            entry, data=request.data, partial=True, context={"campaign_id": campaign_id}
        )
        serializer.is_valid(raise_exception=True)
        return Response(CampaignEncampmentSerializer(encampments.update(entry, serializer.validated_data)).data)


class CampaignLocationsView(CampaignScopedView):
    """GET: the locations. POST: add one (manage_locations). Both need the Locations page switched on."""

    feature_flag = "enable_locations"
    rules = {"GET": "view", "POST": "manage_locations"}

    def get(self, request, campaign_id):
        return Response(CampaignLocationSerializer(locations.locations(campaign_id), many=True).data)

    def post(self, request, campaign_id):
        serializer = CampaignLocationWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = locations.create(campaign_id, serializer.validated_data)
        return Response(CampaignLocationSerializer(entry).data, status=status.HTTP_201_CREATED)


class CampaignLocationDetailView(CampaignScopedView):
    """PATCH: edit a location (manage_locations, with the page switched on)."""

    feature_flag = "enable_locations"
    rules = {"PATCH": "manage_locations"}

    def patch(self, request, campaign_id, location_id):
        entry = CampaignLocation.objects.filter(id=location_id, campaign_id=campaign_id).first()
        if not entry:
            return not_found()
        serializer = CampaignLocationWriteSerializer(entry, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(CampaignLocationSerializer(locations.update(entry, serializer.validated_data)).data)


class CampaignHouseRulesView(CampaignScopedView):
    """GET: the house rules. POST: add one (manage_rules); one per item effect (BUG-52), so a repeat answers 200."""

    rules = {"GET": "view", "POST": "manage_rules"}

    def get(self, request, campaign_id):
        return Response(CampaignHouseRuleSerializer(house_rules.rules(campaign_id), many=True).data)

    def post(self, request, campaign_id):
        serializer = CampaignHouseRuleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rule, created = house_rules.create_rule(campaign_id, serializer.validated_data)
        answer_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(CampaignHouseRuleSerializer(rule).data, status=answer_status)


class CampaignHouseRuleDetailView(CampaignScopedView):
    """PATCH: edit a house rule; its clones change only with its effect (PERF-44). DELETE: remove it."""

    rules = {"PATCH": "manage_rules", "DELETE": "manage_rules"}

    def patch(self, request, campaign_id, rule_id):
        rule = CampaignHouseRule.objects.filter(id=rule_id, campaign_id=campaign_id).first()
        if not rule:
            return not_found()
        serializer = CampaignHouseRuleCreateSerializer(rule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(CampaignHouseRuleSerializer(house_rules.update_rule(rule, serializer.validated_data)).data)

    def delete(self, request, campaign_id, rule_id):
        rule = CampaignHouseRule.objects.filter(id=rule_id, campaign_id=campaign_id).first()
        if not rule:
            return not_found()
        house_rules.delete_rule(rule)
        return Response(status=status.HTTP_204_NO_CONTENT)
