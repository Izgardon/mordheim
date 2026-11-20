"""The warband rules its plot writes (apps/plots), and the only thing campaign points drive.

A warband follows one plot of its campaign's and holds a campaign point total it types itself. From those two the
server writes **an achievement rule for each rung the total has reached**, named by the rung and carrying its text
(`WarbandRule.from_plot`): added when the total reaches it, removed when the total drops below it again, replaced
when the plot changes (William: "Added automatically but removed if number goes under and replaced if plot
changes"). Only earned plot points fall into Warband rules (William, 20 Nov 2026): the plan itself is not a rule
here any more but the plot's own page, read from the sheet (`plots/selectors.py: warband_plot`) under Plot Details.

`sync_plot_rules` is the one way such a rule is written: it works out what the warband's plot and total ask for and
makes the rules match, so running it twice changes nothing the second time. A player's edit to one of these rules is
lost the next time it runs, which is what mirroring the ladder costs. The player's own rules (no `from_plot`) are
never read, moved or touched.

Nothing here scores, totals or wins: a plot's effects are text the player reads.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from rest_framework import serializers

from apps.plots.models import Plot, PlotAchievement
from apps.plots.selectors import plays_with
from apps.warbands.models import Warband, WarbandRule

MAX_TITLE = 160
NOT_PLAYED = "That isn't one of the plots this campaign plays with."


def check_plot(campaign_id: int, validated: Mapping[str, Any]) -> None:
    """A write's `plot_id` must be one the campaign plays with, as the campaign's own entry for it (a 400 for
    anything else, SEC-07); none sent, or null, asks nothing. Two queries, only when one is sent."""
    sent = validated.get("plot_id")
    if sent is None:
        return
    if sent not in plays_with(campaign_id):
        raise serializers.ValidationError({"plot_id": [NOT_PLAYED]})


@dataclass(frozen=True)
class DerivedRule:
    """The rule one rung of the ladder asks for."""

    title: str
    description: str
    achievement: PlotAchievement


def plot_with_ladder(plot_id: int | None) -> Plot | None:
    """The plot with its ladder, or None (two queries when there is a plot)."""
    if plot_id is None:
        return None
    return Plot.objects.prefetch_related("achievements").filter(pk=plot_id).first()


def achievement_rule(rung: PlotAchievement) -> DerivedRule:
    """The rule a rung reached gives the warband: the rung's name and what it gives."""
    title = f"{rung.points} CP: {rung.name}" if rung.name else f"{rung.points} CP"
    return DerivedRule(title[:MAX_TITLE], rung.text, rung)


def rules_for(plot: Plot | None, total: int) -> list[DerivedRule]:
    """What the warband's plot and total ask for: a rule per rung the total has reached."""
    if plot is None:
        return []
    return [achievement_rule(rung) for rung in plot.achievements.all() if rung.points <= total]


def sync_plot_rules(warband: Warband) -> None:
    """Make the warband's plot rules match its plot and total: add what is missing, rewrite what has changed, and
    delete the rest. Idempotent, and the caller holds the transaction (four queries at most)."""
    plot = plot_with_ladder(warband.plot_id)
    asked = rules_for(plot, warband.campaign_points)
    wanted: dict[int, DerivedRule] = {rule.achievement.pk: rule for rule in asked}
    rewrite: list[WarbandRule] = []
    drop: list[int] = []
    for held in warband.rules.filter(from_plot__isnull=False):
        rung_id = held.plot_achievement_id
        follows = held.from_plot_id == warband.plot_id
        target = wanted.pop(rung_id, None) if follows and rung_id is not None else None
        if target is None:
            drop.append(held.pk)
        elif (held.title, held.description) != (target.title, target.description):
            held.title, held.description = target.title, target.description
            rewrite.append(held)
    if drop:
        WarbandRule.objects.filter(pk__in=drop).delete()
    if rewrite:
        WarbandRule.objects.bulk_update(rewrite, ["title", "description"])
    WarbandRule.objects.bulk_create(
        WarbandRule(
            warband=warband,
            title=rule.title,
            description=rule.description,
            from_plot_id=warband.plot_id,
            plot_achievement=rule.achievement,
        )
        for _, rule in sorted(wanted.items())
    )
