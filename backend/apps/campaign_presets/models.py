"""Campaign presets (William, 17 Nov 2026): which published campaign a campaign plays.

A campaign makes two choices, and they are not the same choice. The preset is the published campaign being played
(Mordheim, Mutiny in Marienburg …), one only, and it dictates the *rules*: the structural settings and the
campaign's own rule text. The content in play (`Campaign.campaign_types`) is guided by it and stays the owner's to
change, because "content is different to rules" (William).

Every structural field a preset may dictate is nullable (`hero_death_roll` blank, `exploration_chart` null): left
out, the preset says nothing about it and the campaign keeps its own value. Silence is data — Mordheim's preset
dictates nothing at all. Nothing here blocks anything: a preset-set control is greyed and still operable, and
departing from it warns (a guide, not a gatekeeper).

The presets are seeded from `catalogue_import/sources/campaign-presets/` (`seed_campaign_presets`), with their rule
text from `sources/campaign-rules/`.
"""

from typing import Any

from django.db import models

from apps.campaigns.models import HERO_DEATH_ROLL_CHOICES, MAX_CAMPAIGN_RULE_TEXT


class CampaignPreset(models.Model):
    """One published campaign. `settings` are the settings it suggests ticking (the guide, never a replacement for
    what the campaign already has); the rest is what it dictates, each null when it says nothing."""

    slug = models.SlugField(max_length=60, unique=True)
    name = models.CharField(max_length=120)
    sort_order = models.PositiveSmallIntegerField(default=0)  # Mordheim first, then the others in the settings' order
    # the content it guides towards: these settings are ticked on top of the campaign's own, never instead of them
    settings: models.ManyToManyField = models.ManyToManyField(
        "campaigns.CampaignType", related_name="campaign_presets", blank=True
    )
    exploration_chart = models.ForeignKey(
        "exploration.ExplorationChart",
        related_name="campaign_presets",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    enable_locations = models.BooleanField(null=True, blank=True)
    enable_encampments = models.BooleanField(null=True, blank=True)
    enable_campaign_points = models.BooleanField(null=True, blank=True)
    enable_blood_pacts = models.BooleanField(null=True, blank=True)
    max_heroes = models.PositiveSmallIntegerField(null=True, blank=True)
    hero_death_roll = models.CharField(max_length=10, choices=HERO_DEATH_ROLL_CHOICES, blank=True, default="")

    class Meta:
        db_table = "campaign_preset"
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name


class CampaignPresetRule(models.Model):
    """One of the preset's rules, in the book's order, as `CampaignRule` holds a campaign's own."""

    preset = models.ForeignKey(CampaignPreset, related_name="rules", on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)
    title = models.CharField(max_length=160)
    text = models.TextField(max_length=MAX_CAMPAIGN_RULE_TEXT, blank=True, default="")

    class Meta:
        db_table = "campaign_preset_rule"
        ordering = ["order", "id"]
        constraints = [models.UniqueConstraint(fields=["preset", "title"], name="campaign_preset_rule_unique_title")]

    def __str__(self) -> str:
        return f"{self.preset_id}:{self.title}"


class Dictated:
    """One structural setting a preset may dictate: the preset's field, the campaign settings field it writes, and
    the label the pages show it under."""

    __slots__ = ("field", "settings_field", "label")

    def __init__(self, field: str, label: str, settings_field: str | None = None) -> None:
        self.field = field
        self.label = label
        self.settings_field = settings_field or field

    def value(self, preset: CampaignPreset) -> Any:
        """What the preset says, or None when it says nothing."""
        stated = getattr(preset, self.field)
        return None if stated == "" else stated


# What a preset may dictate, in the order the pages show it. A field not here is the campaign's alone, whatever a
# preset's source file says: the seeder refuses an unknown key.
DICTATED: tuple[Dictated, ...] = (
    Dictated("exploration_chart_id", "Exploration chart"),
    Dictated("enable_locations", "Locations"),
    Dictated("enable_encampments", "Encampments"),
    Dictated("enable_campaign_points", "Plots and CP"),
    Dictated("enable_blood_pacts", "Blood pacts"),
    Dictated("max_heroes", "Most heroes"),
    Dictated("hero_death_roll", "Hero death roll"),
)
DICTATED_BY_FIELD = {entry.field: entry for entry in DICTATED}
