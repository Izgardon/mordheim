"""The campaign's own rules (William, 7 Nov 2026: "campaign wide rules that are not house rules, kind of like warband
rules"), in their order: a new one goes last, and a reorder sends every rule's id in its new order."""

from typing import Any

from django.db import transaction
from django.db.models import Max, QuerySet

from ..errors import CampaignError
from ..models import CampaignRule

ORDER_REFUSED = "Send every campaign rule's id once, in its new order."


def campaign_rules(campaign_id: int) -> "QuerySet[CampaignRule]":
    return CampaignRule.objects.filter(campaign_id=campaign_id).order_by("order", "id")


def create_rule(campaign_id: int, validated: dict[str, Any]) -> CampaignRule:
    """The new rule, after the campaign's others (two at once may share a place; the older is listed first)."""
    last = campaign_rules(campaign_id).aggregate(last=Max("order"))["last"]
    return CampaignRule.objects.create(campaign_id=campaign_id, order=0 if last is None else last + 1, **validated)


def reorder(campaign_id: int, ids: list[int]) -> list[CampaignRule]:
    """Give each rule its place in `ids`, which names each of the campaign's rules once; the rules in that order."""
    with transaction.atomic():
        rules = list(campaign_rules(campaign_id).select_for_update())
        if len(set(ids)) != len(ids) or set(ids) != {rule.id for rule in rules}:
            raise CampaignError(ORDER_REFUSED, code="campaign_rules_order", fields={"ids": [ORDER_REFUSED]})
        place = {rule_id: index for index, rule_id in enumerate(ids)}
        for rule in rules:
            rule.order = place[rule.id]
        CampaignRule.objects.bulk_update(rules, ["order"])
    return sorted(rules, key=lambda rule: rule.order)
