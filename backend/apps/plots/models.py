"""Plots as catalogue data: the path a warband follows through a campaign, scoring campaign points and winning at 40.

"Plot" is the name in every setting. Mutiny in Marienburg prints ten; Border Town Burning calls its six "objectives"
and the Sealed City its six "ambitions", which we do not: they are plots too, each carrying the setting it was
printed in. A plot holds its scoring lines
(what earns or costs campaign points) and its achievement ladder (what the total unlocks). Both are text the player
reads: nothing here is applied, logged or automated.

`who_text` is deliberately unmatched prose (William: "the allowed warbands for a plot doesn't need to be matched, it
can just be a written section that the player decides on"), so there are no `WarbandAccess` rows, no who-can and no
greying: it is a sentence the player decides on.

A plot is a catalogue entry (`CatalogueEntry`), so a campaign's house version replaces the book's through `replaces`
with its own copies of its lines (apps/core/catalogue). A campaign holds the plots it plays with as `CampaignPlot`
rows (a many-to-many, not the one chart `CampaignSettings.exploration_chart` holds), which its preset gives while
Plots is on (apps/campaign_presets/services/preset_lists.py), whatever settings it ticks for content.
"""

from django.db import models

from apps.core.models import CatalogueEntry, version_constraints

WINNING_POINTS = 40  # the campaign point total that wins; every book plot's top rung


class Plot(CatalogueEntry):
    """One plot. `variant_of` is the slug of the plot the book prints this one as a variant of (blank: none); a
    variant is a plot of its own with its whole ladder written out. `no_alliance_with` is the slugs of the plots it
    may not ally with (Border Town Burning names them; Mutiny in Marienburg has no alliances)."""

    campaign = models.ForeignKey(
        "campaigns.Campaign", related_name="plots", null=True, blank=True, on_delete=models.CASCADE
    )  # null: the book
    campaign_type = models.ForeignKey(  # its setting, which holds its grade (grading phase 1)
        "campaigns.CampaignType", related_name="plots", null=True, blank=True, on_delete=models.RESTRICT
    )
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=160, blank=True, default="")  # the import's: the book is upserted by it
    summary = models.TextField(max_length=4000, blank=True, default="")
    who_text = models.TextField(max_length=2000, blank=True, default="")  # who may follow it, as prose
    variant_of = models.CharField(max_length=160, blank=True, default="")
    no_alliance_with = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "plot"
        ordering = ["name", "id"]
        constraints = [
            *version_constraints("plot"),
            models.UniqueConstraint(fields=["campaign", "name"], name="plot_unique_name", nulls_distinct=False),
            models.UniqueConstraint(
                fields=["slug"],
                condition=models.Q(campaign__isnull=True) & ~models.Q(slug=""),
                name="plot_slug",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class PlotScoringLine(models.Model):
    """One line of what the plot scores, in the book's order. `points` is a flat number, negative where the book
    takes points away, and null where the line rolls dice; `dice` carries the sign in the string ("-D3")."""

    plot = models.ForeignKey(Plot, related_name="scoring_lines", on_delete=models.CASCADE)
    position = models.PositiveSmallIntegerField(default=0)
    points = models.SmallIntegerField(null=True, blank=True)
    dice = models.CharField(max_length=12, blank=True, default="")
    text = models.TextField(max_length=4000, blank=True, default="")

    class Meta:
        db_table = "plot_scoring_line"
        ordering = ["position", "id"]

    def __str__(self) -> str:
        return self.text[:60]


class PlotAchievement(models.Model):
    """One rung of the ladder: what the plot unlocks at `points` campaign points. Every book plot has seven, at 5,
    10, 15, 20, 25, 35 and 40 — there is no 30, in the book or on the printed track — and 40 wins the campaign; the
    Sealed City's Purge the Intruders adds one at 0, held from the start. A custom plot may have any ladder it likes,
    so nothing here requires the seven."""

    plot = models.ForeignKey(Plot, related_name="achievements", on_delete=models.CASCADE)
    points = models.SmallIntegerField()
    name = models.CharField(max_length=160, blank=True, default="")
    text = models.TextField(max_length=4000, blank=True, default="")

    class Meta:
        db_table = "plot_achievement"
        ordering = ["points", "id"]

    def __str__(self) -> str:
        return f"{self.points}: {self.name}"


class CampaignPlot(models.Model):
    """A plot the campaign plays with. The rows are the campaign's whole list: picking none is picking none, never
    "fall back to something", so nothing downstream reasons about an empty list. A campaign's own plot deleted goes
    with its row (CASCADE); a book plot the campaign later edits is read as its version (selectors.py)."""

    campaign = models.ForeignKey("campaigns.Campaign", related_name="plot_picks", on_delete=models.CASCADE)
    plot = models.ForeignKey(Plot, related_name="campaign_picks", on_delete=models.CASCADE)

    class Meta:
        db_table = "campaign_plot"
        ordering = ["plot__name", "id"]
        constraints = [models.UniqueConstraint(fields=["campaign", "plot"], name="campaign_plot_once")]

    def __str__(self) -> str:
        return f"Plot {self.plot_id} in campaign {self.campaign_id}"
