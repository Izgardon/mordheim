"""The warband rules its plot writes (apps/plots), and the only thing campaign points drive.

A warband follows one plot of its campaign's and holds a campaign point total it types itself. Two kinds of rule
follow from that, both the server's (`WarbandRule.from_plot`), neither hand-written:

- **the plot's own rule**, carrying the whole plan: its name, what it scores, and all its achievements, every rung
  listed from the start (William: the player reads the plan, so he sees the ladder before he is anywhere near it).
  Added when the plot is picked, replaced when it changes, removed with it;
- **an achievement rule** for each rung the total has reached, named by the rung and carrying its text. Added when
  the total reaches it, removed when the total drops below it again, replaced when the plot changes (William:
  "Added automatically but removed if number goes under and replaced if plot changes").

`sync_plot_rules` is the one way either is written: it works out what the warband's plot and total ask for and makes
the rules match, so running it twice changes nothing the second time. A player's edit to one of these rules is lost
the next time it runs, which is what mirroring the ladder costs. The player's own rules (no `from_plot`) are never
read, moved or touched.

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
    """A rule the plot asks for: `achievement` None is the plot's own rule."""

    title: str
    description: str
    achievement: PlotAchievement | None = None


def plot_with_lines(plot_id: int | None) -> Plot | None:
    """The plot with its scoring lines and its ladder, or None (one query for each when there is a plot)."""
    if plot_id is None:
        return None
    return Plot.objects.prefetch_related("scoring_lines", "achievements").filter(pk=plot_id).first()


def _scored(line: object) -> str:
    """A scoring line's number as the plot prints it: "+1", "-1", "D6", "-D3", or nothing where it says none."""
    dice = str(getattr(line, "dice", "") or "")
    if dice:
        return dice
    points = getattr(line, "points", None)
    if points is None:
        return ""
    return f"+{points}" if points > 0 else str(points)


def plot_rule(plot: Plot) -> DerivedRule:
    """The plot's own rule: its summary, what it scores and every rung of its ladder."""
    parts = [plot.summary.strip()] if plot.summary.strip() else []
    scoring = [f"{_scored(line)} {line.text}".strip() for line in plot.scoring_lines.all()]
    if scoring:
        parts.append("\n".join(["Campaign points", *scoring]))
    ladder = [_rung_line(rung) for rung in plot.achievements.all()]
    if ladder:
        parts.append("\n".join(["Achievements", *ladder]))
    return DerivedRule(f"Plot: {plot.name}"[:MAX_TITLE], "\n\n".join(parts))


def _rung_line(rung: PlotAchievement) -> str:
    """One rung on the plot's own rule: "15 - Rising star: what it gives"."""
    named = f"{rung.points} - {rung.name}" if rung.name else str(rung.points)
    return f"{named}: {rung.text}".strip(": ") if rung.text else named


def achievement_rule(rung: PlotAchievement) -> DerivedRule:
    """The rule a rung reached gives the warband: the rung's name and what it gives."""
    title = f"{rung.points} CP: {rung.name}" if rung.name else f"{rung.points} CP"
    return DerivedRule(title[:MAX_TITLE], rung.text, rung)


def rules_for(plot: Plot | None, total: int) -> list[DerivedRule]:
    """What the warband's plot and total ask for: the plot's own rule, then the rungs the total has reached."""
    if plot is None:
        return []
    reached = [rung for rung in plot.achievements.all() if rung.points <= total]
    return [plot_rule(plot), *(achievement_rule(rung) for rung in reached)]


def sync_plot_rules(warband: Warband) -> None:
    """Make the warband's plot rules match its plot and total: add what is missing, rewrite what has changed, and
    delete the rest. Idempotent, and the caller holds the transaction (four queries at most)."""
    plot = plot_with_lines(warband.plot_id)
    asked = rules_for(plot, warband.campaign_points)
    wanted: dict[int | None, DerivedRule] = {rule.achievement.pk if rule.achievement else None: rule for rule in asked}
    rewrite: list[WarbandRule] = []
    drop: list[int] = []
    for held in warband.rules.filter(from_plot__isnull=False):
        target = wanted.pop(held.plot_achievement_id, None) if held.from_plot_id == warband.plot_id else None
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
        for _, rule in sorted(wanted.items(), key=lambda pair: (pair[0] is not None, pair[0] or 0))
    )
