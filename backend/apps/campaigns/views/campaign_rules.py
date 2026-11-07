"""The campaign's own rules (William, 7 Nov 2026: "campaign wide rules that are not house rules ... admin only"): every
member reads them; its owner and admins (`manage_campaign_rules`) add, edit, reorder and delete them."""

from rest_framework import status
from rest_framework.response import Response

from ..serializers.content import CampaignRuleOrderSerializer, CampaignRuleSerializer
from ..services import campaign_rules
from .base import CampaignScopedView

WRITE = "manage_campaign_rules"


class CampaignRulesView(CampaignScopedView):
    """GET: the rules in their order. POST: add one, last."""

    rules = {"GET": "view", "POST": WRITE}

    def get(self, request, campaign_id):
        return Response(CampaignRuleSerializer(campaign_rules.campaign_rules(campaign_id), many=True).data)

    def post(self, request, campaign_id):
        serializer = CampaignRuleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rule = campaign_rules.create_rule(campaign_id, serializer.validated_data)
        return Response(CampaignRuleSerializer(rule).data, status=status.HTTP_201_CREATED)


class CampaignRuleDetailView(CampaignScopedView):
    """PATCH: its title or body. DELETE: remove it."""

    rules = {"PATCH": WRITE, "DELETE": WRITE}

    def patch(self, request, campaign_id, rule_id):
        rule = campaign_rules.campaign_rules(campaign_id).filter(id=rule_id).first()
        if not rule:
            return Response({"detail": "Not found"}, status=404)
        serializer = CampaignRuleSerializer(rule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(CampaignRuleSerializer(serializer.save()).data)

    def delete(self, request, campaign_id, rule_id):
        if not campaign_rules.campaign_rules(campaign_id).filter(id=rule_id).delete()[0]:
            return Response({"detail": "Not found"}, status=404)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CampaignRuleOrderView(CampaignScopedView):
    """PUT {ids}: every rule's id in its new order; the answer is the list as it now stands."""

    rules = {"PUT": WRITE}

    def put(self, request, campaign_id):
        serializer = CampaignRuleOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rules = campaign_rules.reorder(campaign_id, serializer.validated_data["ids"])
        return Response(CampaignRuleSerializer(rules, many=True).data)
