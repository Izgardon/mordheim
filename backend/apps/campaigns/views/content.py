"""Campaign content: house rules."""

from rest_framework import status
from rest_framework.response import Response

from ..effects import common_rules
from ..models import CampaignHouseRule
from ..serializers.content import (
    CampaignHouseRuleCreateSerializer,
    CampaignHouseRuleSerializer,
)
from ..services import house_rules
from .base import CampaignScopedView


def not_found() -> Response:
    return Response({"detail": "Not found"}, status=404)


class CampaignHouseRulesView(CampaignScopedView):
    """GET: the house rules. POST: add one (manage_rules); one per item effect (BUG-52), so a repeat answers 200. The
    answer's `warnings` name the campaign's own versions an effect left alone (`house_rule_skipped`)."""

    rules = {"GET": "view", "POST": "manage_rules"}

    def get(self, request, campaign_id):
        return Response(CampaignHouseRuleSerializer(house_rules.rules(campaign_id), many=True).data)

    def post(self, request, campaign_id):
        serializer = CampaignHouseRuleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rule, created, skipped = house_rules.create_rule(campaign_id, serializer.validated_data)
        answer_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        answer = {**CampaignHouseRuleSerializer(rule).data, "warnings": house_rules.skipped_warnings(skipped)}
        return Response(answer, status=answer_status)


class CampaignCommonRulesView(CampaignScopedView):
    """GET: the ready-made house rules the House Rules page offers, two of them with an item effect (IMP-69)."""

    def get(self, request, campaign_id):
        return Response(common_rules())


class CampaignHouseRuleDetailView(CampaignScopedView):
    """PATCH: edit a house rule; its clones change only with its effect (PERF-44), and `warnings` say which of the
    campaign's own versions a new effect left alone. DELETE: remove it."""

    rules = {"PATCH": "manage_rules", "DELETE": "manage_rules"}

    def patch(self, request, campaign_id, rule_id):
        rule = CampaignHouseRule.objects.filter(id=rule_id, campaign_id=campaign_id).first()
        if not rule:
            return not_found()
        serializer = CampaignHouseRuleCreateSerializer(rule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        rule, skipped = house_rules.update_rule(rule, serializer.validated_data)
        return Response({**CampaignHouseRuleSerializer(rule).data, "warnings": house_rules.skipped_warnings(skipped)})

    def delete(self, request, campaign_id, rule_id):
        rule = CampaignHouseRule.objects.filter(id=rule_id, campaign_id=campaign_id).first()
        if not rule:
            return not_found()
        house_rules.delete_rule(rule)
        return Response(status=status.HTTP_204_NO_CONTENT)
