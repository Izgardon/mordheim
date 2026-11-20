"""Swapping a campaign's preset content: the old published campaign's out, the new one's in.

William, 20 Nov 2026: "We need a clean way of swapping the rules in and out if changing campaign, can it clear the
unedited ones that were there previously?" Changing preset used to leave the old campaign's rules and charts piled
under the new one's -- Marienburg's 55 rules and 14 charts still sitting there under Khemri's.

**Unedited means word for word.** A rule or chart is taken out only when it still matches some *other* published
campaign's exactly: its kind, title, body and umbrella, or its title, when it is rolled, dice, note and every
result. Anything the player wrote, and anything he changed by a single character, stays. That needs nothing stored
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


def _rule_print(kind: str, title: str, body: str, umbrella: str) -> tuple:
    return (_words(kind), _words(title).lower(), _words(body), _words(umbrella).lower())


def _chart_print(title: str, description: str, dice: str, note: str, rows: Any) -> tuple:
    return (
        _words(title).lower(),
        _words(description),
        _words(dice),
        _words(note),
        tuple((_words(row.result), _words(row.name), _words(row.text)) for row in rows),
    )


def _rule_prints(rows: Any) -> set[tuple]:
    return {_rule_print(row.kind, row.title, row.text, row.umbrella) for row in rows}


def _chart_prints(rows: Any) -> set[tuple]:
    return {_chart_print(row.title, row.description, row.dice, row.note, row.rows.all()) for row in rows}


def removable(campaign: Campaign, preset: CampaignPreset | None) -> tuple[list[int], list[int]]:
    """The ids of the campaign's rules and charts that are still **another** published campaign's, word for word.

    A rule this campaign's own preset also holds is never one of them, however many other campaigns share it: the
    published campaigns repeat each other (both Marienburg and Border Town Burning set buildings on fire in the
    same words), so matching "some other campaign" alone would offer to take out what the campaign is meant to
    have.
    """
    every_rule = list(CampaignPresetRule.objects.all())
    mine = _rule_prints(r for r in every_rule if preset is not None and r.preset_id == preset.pk)
    theirs = _rule_prints(r for r in every_rule if preset is None or r.preset_id != preset.pk)
    rules = [
        rule.pk
        for rule in CampaignRule.objects.filter(campaign=campaign)
        if (print_ := _rule_print(rule.kind, rule.title, rule.body, rule.umbrella)) in theirs and print_ not in mine
    ]
    every_chart = list(CampaignPresetChart.objects.filter(rule__isnull=True, row__isnull=True).prefetch_related("rows"))
    my_charts = _chart_prints(c for c in every_chart if preset is not None and c.preset_id == preset.pk)
    their_charts = _chart_prints(c for c in every_chart if preset is None or c.preset_id != preset.pk)
    charts = [
        chart.pk
        for chart in CampaignChart.objects.filter(
            campaign=campaign, rule__isnull=True, row__isnull=True
        ).prefetch_related("rows")
        if (mark := _chart_print(chart.title, chart.description, chart.dice, chart.note, chart.rows.all()))
        in their_charts
        and mark not in my_charts
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
