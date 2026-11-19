"""A campaign's charts: the dice tables a player looks up mid-game (William, 19 Nov 2026).

A chart is a title, a line or two on when it is rolled, the dice it is rolled on and a row per result. The shape is
the exploration chart's rather than a grid of cells, because the published campaigns' tables are mostly *prose*: a
monster table's row is a name alone ("D3 Cultists of Chaos"), a weather table's is a name and a short effect, and
Marienburg's Seaside Situations give each D66 result a name and a paragraph. One shape reads all of them, and a
nested sub-table of two or three lines rides inside its row's text (William: "a rule can keep a small table").

Nothing here is applied, rolled or logged: a chart is read, as a campaign rule is.
"""

from django.db import models

from .campaign import Campaign

MAX_CHART_ROW_TEXT = 4000
# The dice a chart is rolled on, as the pages spell them; blank for a chart with no dice of its own.
CHART_DICE = ("D3", "D6", "2D6", "3D6", "D66", "D100")


class CampaignChart(models.Model):
    """One of the campaign's charts, with its place in the list. Its owner and admins write and order them; every
    member reads them. `note` carries what is true of the whole chart rather than one row: the modifiers, and what
    to do with a result the chart sends on elsewhere.

    A chart may instead **belong to a rule** (William, 20 Nov 2026: "charts should only really be used for clear
    reference charts"). Then it is that rule's own table: it shows inside the rule and is left out of the Charts
    list, so a rule may hold a table of any size without pretending to be a chart a player looks up. It is the same
    model and the same renderer either way; owning a table is all that tells them apart.
    """

    campaign = models.ForeignKey(Campaign, related_name="charts", on_delete=models.CASCADE)
    rule = models.ForeignKey(
        "campaigns.CampaignRule", related_name="charts", null=True, blank=True, on_delete=models.CASCADE
    )
    title = models.CharField(max_length=160)
    description = models.TextField(max_length=2000, blank=True, default="")
    dice = models.CharField(max_length=6, choices=[(die, die) for die in CHART_DICE], blank=True, default="")
    note = models.TextField(max_length=2000, blank=True, default="")
    umbrella = models.CharField(max_length=120, blank=True, default="")  # as a rule's: several charts under one name
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "campaign_chart"
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.campaign_id}:{self.title}"


class CampaignChartRow(models.Model):
    """One result on a chart. `result` is what was rolled, as the book writes it ("2", "3-4", "11-15"), so a chart
    whose bands are uneven needs nothing of its own; `name` is the result's short name, blank where it has none."""

    chart = models.ForeignKey(CampaignChart, related_name="rows", on_delete=models.CASCADE)
    result = models.CharField(max_length=20)
    name = models.CharField(max_length=160, blank=True, default="")
    text = models.TextField(max_length=MAX_CHART_ROW_TEXT, blank=True, default="")
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "campaign_chart_row"
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.chart_id}:{self.result}"
