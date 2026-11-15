"""Exploration charts as catalogue data (William, 12 Nov 2026): the post-game chart a campaign explores by.

A chart holds the income table (what a dice total is worth), the dice rule and the places the multiples find, each
with its rules text. William's ruling is that a place is text: "we can keep it pretty much all text, then a user can
add/give themselves whatever they need, no need to automate it", so nothing here is applied or logged beyond the
shards the income table gives.

It is a catalogue entry (`CatalogueEntry`), so a campaign's house version replaces the book's chart through
`replaces`, with its own copies of its places (apps/core/catalogue). A campaign picks the chart it uses
(`CampaignSettings.exploration_chart`); null means the book's Mordheim chart, which is a seeded row like any other.
"""

from django.db import models

from apps.core.models import CatalogueEntry, version_constraints

MOST_OF_A_KIND = 6  # the largest multiple a chart names a place for
DEFAULT_DICE_PER_HERO = 1  # the chart fields' defaults, which a database with no chart seeded still reads by
DEFAULT_DICE_FOR_WIN = 1
DEFAULT_MAX_DICE = 10
DEFAULT_MAX_CHOSEN = 6
MULTIPLE_LABELS = {2: "Doubles", 3: "Triples", 4: "Four of a kind", 5: "Five of a kind", 6: "Six of a kind"}


class ExplorationChart(CatalogueEntry):
    """One exploration chart. `income` is the table the dice total is read on, lowest band first:
    `[{"max_total": 5, "amount": 1}, …, {"max_total": null, "amount": 7}]` (null: any higher total). `dice_per_hero`
    and `dice_for_win` are the dice a warband rolls, `max_dice` the most it may roll at all and `max_chosen` the most
    it may keep; the page warns past them, it never refuses."""

    campaign = models.ForeignKey(
        "campaigns.Campaign", related_name="exploration_charts", null=True, blank=True, on_delete=models.CASCADE
    )  # null: the book
    campaign_type = models.ForeignKey(  # its setting, which holds its grade (grading phase 1)
        "campaigns.CampaignType", related_name="exploration_charts", null=True, blank=True, on_delete=models.RESTRICT
    )
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=160, blank=True, default="")  # the import's: the book is upserted by it
    summary = models.TextField(max_length=4000, blank=True, default="")
    dice_per_hero = models.PositiveSmallIntegerField(default=DEFAULT_DICE_PER_HERO)
    dice_for_win = models.PositiveSmallIntegerField(default=DEFAULT_DICE_FOR_WIN)
    max_dice = models.PositiveSmallIntegerField(default=DEFAULT_MAX_DICE)
    max_chosen = models.PositiveSmallIntegerField(default=DEFAULT_MAX_CHOSEN)
    income = models.JSONField(default=list, blank=True)
    income_note = models.TextField(max_length=2000, blank=True, default="")

    class Meta:
        db_table = "exploration_chart"
        ordering = ["name", "id"]
        constraints = [
            *version_constraints("exploration_chart"),
            models.UniqueConstraint(
                fields=["campaign", "name"], name="exploration_chart_unique_name", nulls_distinct=False
            ),
            models.UniqueConstraint(
                fields=["slug"],
                condition=models.Q(campaign__isnull=True) & ~models.Q(slug=""),
                name="exploration_chart_slug",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class ExplorationPlace(models.Model):
    """The place a chart gives for `count` of a `face` (two 1s is the Well), and what finding it does, as text."""

    chart = models.ForeignKey(ExplorationChart, related_name="places", on_delete=models.CASCADE)
    count = models.PositiveSmallIntegerField()
    face = models.PositiveSmallIntegerField()
    name = models.CharField(max_length=160)
    rules = models.TextField(max_length=4000, blank=True, default="")

    class Meta:
        db_table = "exploration_place"
        ordering = ["count", "face", "id"]
        constraints = [
            models.UniqueConstraint(fields=["chart", "count", "face"], name="exploration_place_once"),
            models.CheckConstraint(check=models.Q(count__gte=2, count__lte=6), name="exploration_place_count"),
            models.CheckConstraint(check=models.Q(face__gte=1, face__lte=6), name="exploration_place_face"),
        ]

    def __str__(self) -> str:
        return self.name

    @property
    def label(self) -> str:
        """What the chart calls this multiple ("Doubles")."""
        return MULTIPLE_LABELS.get(self.count, f"{self.count} of a kind")
