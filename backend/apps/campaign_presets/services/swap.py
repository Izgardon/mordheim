"""Swapping a campaign's preset content: the old published campaign's out, the new one's in.

William, 20 Nov 2026: "We need a clean way of swapping the rules in and out if changing campaign, can it clear the
unedited ones that were there previously?" Changing preset used to leave the old campaign's rules and charts piled
under the new one's -- Marienburg's 55 rules and 14 charts still sitting there under Khemri's.

**Unedited means word for word.** A rule or chart is taken out only when it still matches some *other* published
campaign's exactly: its kind, title, body, umbrella and own tables, or its title, when it is rolled, dice, note,
umbrella and every result with the tables hanging off it. Anything the player wrote, and anything he changed by a single character, stays. That needs nothing stored
on the row -- no "came from here" column to keep true through every write path -- and it is self-correcting: edit a
copied rule and it is his from then on.

A rule taken out takes its own table with it (the FK cascades), and a chart takes its results and the tables
hanging off them.
"""

from typing import Any

from apps.campaigns.models import Campaign, CampaignChart, CampaignRule

from ..models import CampaignPreset, CampaignPresetChart, CampaignPresetRule
from .charts import copy_charts
from .rules import copy_rules


def _words(text: Any) -> str:
    return str(text or "").strip()


def _chart_print(chart: Any) -> tuple:
    """A chart word for word: its title, when it is rolled, dice, note and umbrella, and every result with the tables
    hanging off it (read from the prefetch)."""
    rows = tuple(
        (_words(row.result), _words(row.name), _words(row.text), tuple(_chart_print(c) for c in row.charts.all()))
        for row in chart.rows.all()
    )
    words = (chart.title, chart.description, chart.dice, chart.note, chart.umbrella)
    return (*(_words(text) for text in words), rows)


def _rule_print(rule: Any, body: str) -> tuple:
    """A rule word for word: its kind, title, body and umbrella, and its own tables."""
    tables = tuple(_chart_print(chart) for chart in rule.charts.all())
    return (_words(rule.kind), _words(rule.title), _words(body), _words(rule.umbrella), tables)


# a rule's own tables and their results' tables, two deep: deeper than any book goes
RULE_TABLES = ("charts__rows__charts__rows",)
CHART_TABLES = ("rows__charts__rows",)


def removable(campaign: Campaign, preset: CampaignPreset | None) -> tuple[list[int], list[int]]:
    """The ids of the campaign's rules and charts that are still **another** published campaign's, word for word.

    A rule this campaign's own preset also holds is never one of them, however many other campaigns share it: the
    published campaigns repeat each other (both Marienburg and Border Town Burning set buildings on fire in the
    same words), so matching "some other campaign" alone would offer to take out what the campaign is meant to
    have.
    """
    every_rule = list(CampaignPresetRule.objects.prefetch_related(*RULE_TABLES))
    mine = {_rule_print(r, r.text) for r in every_rule if preset is not None and r.preset_id == preset.pk}
    theirs = {_rule_print(r, r.text) for r in every_rule if preset is None or r.preset_id != preset.pk}
    rules = [
        rule.pk
        for rule in CampaignRule.objects.filter(campaign=campaign).prefetch_related(*RULE_TABLES)
        if (print_ := _rule_print(rule, rule.body)) in theirs and print_ not in mine
    ]
    every_chart = list(
        CampaignPresetChart.objects.filter(rule__isnull=True, row__isnull=True).prefetch_related(*CHART_TABLES)
    )
    my_charts = {_chart_print(c) for c in every_chart if preset is not None and c.preset_id == preset.pk}
    their_charts = {_chart_print(c) for c in every_chart if preset is None or c.preset_id != preset.pk}
    looked_up = CampaignChart.objects.filter(campaign=campaign, rule__isnull=True, row__isnull=True)
    charts = [
        chart.pk
        for chart in looked_up.prefetch_related(*CHART_TABLES)
        if (mark := _chart_print(chart)) in their_charts and mark not in my_charts
    ]
    return rules, charts


def swap_counts(campaign: Campaign, preset: CampaignPreset | None) -> dict[str, int]:
    """What pressing the button would do: how many of another campaign's rules and charts go, and how many of this
    one's arrive. The page names the button from `out` (William: "can the button be named swap rules")."""
    from .charts import missing_charts
    from .rules import missing_rules

    out_rules, out_charts = removable(campaign, preset)
    return {
        "out": len(out_rules) + len(out_charts),
        "in": len(missing_rules(campaign.pk, preset)) + len(missing_charts(campaign.pk, preset)),
    }


def swap_rules(campaign: Campaign, preset: CampaignPreset | None) -> dict[str, int]:
    """Take out the rules and charts that are still another published campaign's, then copy this one's missing
    ones. Call it inside a transaction: a swap is one change, not a delete the player can be left in the middle
    of."""
    out_rules, out_charts = removable(campaign, preset)
    if out_rules:
        CampaignRule.objects.filter(pk__in=out_rules).delete()
    if out_charts:
        CampaignChart.objects.filter(pk__in=out_charts).delete()
    return {
        "out": len(out_rules) + len(out_charts),
        "in": copy_rules(campaign, preset) + copy_charts(campaign, preset),
    }
