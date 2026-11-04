"""A warband's own rules (models.WarbandRule): members read them, the warband's editors write them, and add its template's
missing ones."""

from django.db import transaction
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.warband_templates.services.raising import add_template_rules
from apps.warbands.models import WarbandRule
from apps.warbands.serializers import WarbandRuleSerializer

from .base import WarbandScopedView

NOT_FOUND = {"detail": "Not found"}


class WarbandRuleListCreateView(WarbandScopedView):
    def get(self, request: Request, warband_id: int) -> Response:
        return Response(WarbandRuleSerializer(self.warband.rules.all(), many=True).data)

    def post(self, request: Request, warband_id: int) -> Response:
        serializer = WarbandRuleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rule = serializer.save(warband=self.warband)
        return Response(WarbandRuleSerializer(rule).data, status=status.HTTP_201_CREATED)


class WarbandRuleDetailView(WarbandScopedView):
    def patch(self, request: Request, warband_id: int, rule_id: int) -> Response:
        rule = WarbandRule.objects.filter(id=rule_id, warband=self.warband).first()
        if rule is None:
            return Response(NOT_FOUND, status=404)
        serializer = WarbandRuleSerializer(rule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(WarbandRuleSerializer(serializer.save()).data)

    def delete(self, request: Request, warband_id: int, rule_id: int) -> Response:
        deleted, _ = WarbandRule.objects.filter(id=rule_id, warband=self.warband).delete()
        if not deleted:
            return Response(NOT_FOUND, status=404)
        return Response(status=status.HTTP_204_NO_CONTENT)


class WarbandRuleFromTemplateView(WarbandScopedView):
    """POST rules/from-template/: Add the template's rules (the templates plan, phase 2), the warband's editors only;
    answers all its rules as they now stand."""

    def post(self, request: Request, warband_id: int) -> Response:
        with transaction.atomic():
            add_template_rules(self.warband)
        return Response(WarbandRuleSerializer(self.warband.rules.all(), many=True).data)
