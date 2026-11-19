"""The campaign's own rules (William, 7 Nov 2026: "campaign wide rules that are not house rules, kind of like warband
rules"), in their order: a new one goes last, and a reorder sends every rule's id in its new order."""

from typing import Any

from django.db import transaction
from django.db.models import Max, QuerySet

from ..errors import CampaignError
from ..models import CampaignChart, CampaignChartRow, CampaignRule

ORDER_REFUSED = "Send every campaign rule's id once, in its new order."


def campaign_rules(campaign_id: int) -> "QuerySet[CampaignRule]":
    """The campaign's rules with each one's own table, in their order (three queries)."""
    return CampaignRule.objects.filter(campaign_id=campaign_id).prefetch_related("charts__rows").order_by("order", "id")


def create_rule(campaign_id: int, validated: dict[str, Any]) -> CampaignRule:
    """The new rule, after the campaign's others (two at once may share a place; the older is listed first), with
    its own table when one was sent."""
    table = validated.pop("chart", None)
    with transaction.atomic():
        last = campaign_rules(campaign_id).aggregate(last=Max("order"))["last"]
        rule = CampaignRule.objects.create(campaign_id=campaign_id, order=0 if last is None else last + 1, **validated)
        write_table(rule, table)
    return rule


def update_rule(rule: CampaignRule, validated: dict[str, Any]) -> CampaignRule:
    """The rule as the request sent it. Its table is replaced only when `chart` was sent: null takes it away."""
    sent_table = "chart" in validated
    table = validated.pop("chart", None)
    with transaction.atomic():
        for field, value in validated.items():
            setattr(rule, field, value)
        rule.save(update_fields=[*validated, "updated_at"] if validated else ["updated_at"])
        if sent_table:
            write_table(rule, table)
    return rule


def write_table(rule: CampaignRule, table: dict[str, Any] | None) -> None:
    """The rule's own table, written afresh. None takes away the one it had."""
    rule.charts.all().delete()
    if table is None:
        return
    rows = table.pop("rows", [])
    chart = CampaignChart.objects.create(
        campaign_id=rule.campaign_id, rule=rule, title=table.pop("title", "") or rule.title, **table
    )
    CampaignChartRow.objects.bulk_create(
        CampaignChartRow(
            chart=chart, result=row["result"], name=row.get("name", ""), text=row.get("text", ""), order=place
        )
        for place, row in enumerate(rows)
    )


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
