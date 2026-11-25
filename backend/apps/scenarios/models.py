"""Scenarios as catalogue data (William, 24 Nov 2026): what a battle is played as, read and never applied.

Every Mordheim scenario follows one pattern: its opening lines, then its sections in order (Terrain, Warbands or
Set-up, Starting the game, Special rules, Ending the game, Experience, sometimes Wyrdstone, and a longer one's own
headings between them). Nothing in a battle changes because of it. A scenario carries no setting and no grade: none
is ever hidden ("settings will pick the ones needed and they are all viable"). A setting adds its scenarios to a
campaign through `SettingScenario` (Mordheim 1a's: the rulebook's nine and Chaos on the Streets' seven, weighted
from their 2D6 tables), and the campaign's own list is its `CampaignScenario` rows, each with a weight the random
draw reads (0: listed and picked by hand, never drawn).

A scenario is a catalogue entry (`CatalogueEntry`): a campaign's version replaces the book's through `replaces`, and
the campaign's list rows and battles follow it there and back (apps/core/catalogue/kinds.py `followers`).
"""

from decimal import Decimal

from django.db import models

from apps.core.models import CatalogueEntry, version_constraints

ONE_V_ONE = "1v1"
MULTIPLAYER = "multiplayer"
EITHER = "either"  # tagged both, or written for both (William, 25 Nov 2026: The Lost Prince)
PLAYERS = ((ONE_V_ONE, "1v1"), (MULTIPLAYER, "Multiplayer"), (EITHER, "1v1 or multiplayer"))
STANDARD_SECTIONS = (  # the titles every scenario names the same way, in their usual order
    "Terrain",
    "Warbands",
    "Set-up",
    "Starting the game",
    "Special rules",
    "Ending the game",
    "Experience",
    "Wyrdstone",
)


class Scenario(CatalogueEntry):
    """One scenario. `sections` is its ordered `[{title, text, tables}]`: a table is the item rules' `{columns,
    rows}`, placed in its section's text by `{{table:N}}`. `number` is its number in its source (blank: none)."""

    campaign = models.ForeignKey(
        "campaigns.Campaign", related_name="scenarios", null=True, blank=True, on_delete=models.CASCADE
    )  # null: the book
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=160, blank=True, default="")  # the import's: the book is upserted by it
    number = models.CharField(max_length=12, blank=True, default="")
    source = models.CharField(max_length=120, blank=True, default="")
    players = models.CharField(max_length=12, choices=PLAYERS, default=ONE_V_ONE)
    summary = models.TextField(max_length=1000, blank=True, default="")
    intro = models.TextField(max_length=20000, blank=True, default="")
    sections = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "scenario"
        ordering = ["name", "id"]
        constraints = [
            *version_constraints("scenario"),
            models.UniqueConstraint(fields=["campaign", "name"], name="scenario_unique_name", nulls_distinct=False),
            models.UniqueConstraint(
                fields=["slug"],
                condition=models.Q(campaign__isnull=True) & ~models.Q(slug=""),
                name="scenario_slug",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class SettingScenario(models.Model):
    """A scenario a setting adds to a campaign that ticks it, at the weight its table gives it."""

    setting = models.ForeignKey("campaigns.CampaignType", related_name="scenario_links", on_delete=models.CASCADE)
    scenario = models.ForeignKey(Scenario, related_name="setting_links", on_delete=models.CASCADE)
    weight = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal(1))

    class Meta:
        db_table = "setting_scenario"
        ordering = ["setting_id", "scenario__name", "id"]
        constraints = [models.UniqueConstraint(fields=["setting", "scenario"], name="setting_scenario_once")]

    def __str__(self) -> str:
        return f"Scenario {self.scenario_id} in setting {self.setting_id}"


class CampaignScenario(models.Model):
    """A scenario on the campaign's list, at the weight the random draw reads (0: never drawn)."""

    campaign = models.ForeignKey("campaigns.Campaign", related_name="scenario_picks", on_delete=models.CASCADE)
    scenario = models.ForeignKey(Scenario, related_name="campaign_picks", on_delete=models.CASCADE)
    weight = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal(1))

    class Meta:
        db_table = "campaign_scenario"
        ordering = ["scenario__name", "id"]
        constraints = [
            models.UniqueConstraint(fields=["campaign", "scenario"], name="campaign_scenario_once"),
            models.CheckConstraint(check=models.Q(weight__gte=0), name="campaign_scenario_weight_not_negative"),
        ]

    def __str__(self) -> str:
        return f"Scenario {self.scenario_id} in campaign {self.campaign_id}"
