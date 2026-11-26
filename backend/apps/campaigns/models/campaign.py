"""The campaign itself: the row, the settings it plays by, and the publication settings its content comes from.

A campaign stores the settings it ticked (`Campaign.campaign_types`, through `CampaignCampaignType`); a grade is a
preset over those, not a field. `apps/campaigns/in_play.py` holds the visibility rule those settings drive.
"""

import uuid

from django.conf import settings
from django.db import models

from apps.warbands.utils.henchmen_level import HENCHMEN_LEVEL_THRESHOLDS
from apps.warbands.utils.hero_level import HERO_LEVEL_THRESHOLDS
from apps.warbands.utils.wyrdstone_prices import get_default_wyrdstone_prices

ROLE_SLUGS = ["owner", "admin", "player"]
# Publication grades, lowest first: a grade's rank is its place here, which every "up to" preset compares
GRADES = ("1a", "1b", "1c", "2a", "2b", "3")
GRADE_LABELS = {
    "1a": "Official",
    "1b": "Unofficial",
    "1c": "Experimental",
    "2a": "Reliable",
    "2b": "Supplemental",
    "3": "Draft",
}
HERO_DEATH_ROLL_CHOICES = [
    ("d66", "D66"),
    ("d100", "D100"),
]
DEFAULT_RESOURCE_NAME = "Wyrdstone"  # every warband's default resource, until the campaign renames it

# What a campaign row is (the workshop plan, docs/plans/workshop.md): a campaign people play, or a workshop, the hidden
# campaign of one player holding his custom warbands, his warband lists and his own catalogue entries
CAMPAIGN = "campaign"
WORKSHOP = "workshop"
CAMPAIGN_KINDS = ((CAMPAIGN, "Campaign"), (WORKSHOP, "Workshop"))


def get_default_hero_level_thresholds():
    return list(HERO_LEVEL_THRESHOLDS)


def get_default_henchmen_level_thresholds():
    return list(HENCHMEN_LEVEL_THRESHOLDS)


class Campaign(models.Model):
    name = models.CharField(max_length=120)
    join_code = models.CharField(max_length=6, unique=True)
    in_progress = models.BooleanField(default=False)
    # set while the campaign is archived: read-only for everyone until its owner restores it (decision 5)
    archived_at = models.DateTimeField(null=True, blank=True)
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="+", on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # the published campaign it plays (apps/campaign_presets), which dictates its rules; null: none picked
    preset = models.ForeignKey(
        "campaign_presets.CampaignPreset", related_name="campaigns", null=True, blank=True, on_delete=models.SET_NULL
    )
    # the settings in play: the ones its owner ticked, and the always-on ones (grading phase 1)
    campaign_types: models.ManyToManyField = models.ManyToManyField(
        "CampaignType", through="CampaignCampaignType", related_name="campaigns", blank=True
    )
    # a campaign, or a workshop (apps/workshop): one player's, made on his first use, never listed, joined or played in
    kind = models.CharField(max_length=10, choices=CAMPAIGN_KINDS, default=CAMPAIGN)
    # a workshop's player, its only member: one live workshop each; null for a campaign
    workshop_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="+", null=True, blank=True, on_delete=models.CASCADE
    )
    # a workshop whose player deleted his account: hidden and unreadable, its codes no longer found; copies stay
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "campaign"
        constraints = [
            models.CheckConstraint(
                check=models.Q(kind=CAMPAIGN, workshop_owner__isnull=True, deleted_at__isnull=True)
                | (
                    models.Q(kind=WORKSHOP)
                    & (models.Q(workshop_owner__isnull=False) | models.Q(deleted_at__isnull=False))
                ),
                name="campaign_kind_fields",
            ),
            models.UniqueConstraint(
                fields=["workshop_owner"], condition=models.Q(deleted_at__isnull=True), name="one_workshop_per_player"
            ),
        ]

    def __str__(self):
        return self.name

    @property
    def is_workshop(self) -> bool:
        return self.kind == WORKSHOP


class CampaignType(models.Model):
    """A setting: the world or supplement content belongs to (Mordheim, Khemri, Lustria …), seeded from the
    catalogue import (`seed_settings`). Only settings carry a grade (grading phase 1): every warband type and
    catalogue entry belongs to one setting through its `campaign_type`, a null one counting as Mordheim's. Mordheim
    itself splits by grade into Mordheim 1a (`always_on`), Mordheim 1b, 1c and 2a, and Grade 3. A campaign ticks the
    settings in play (`Campaign.campaign_types`); picking a grade is a preset that ticks every setting at or below
    it (`apps/campaigns/in_play.py`)."""

    slug = models.SlugField(max_length=40, unique=True)
    name = models.CharField(max_length=80)
    grade = models.CharField(max_length=2, choices=[(grade, grade) for grade in GRADES], default="1a")
    sort_order = models.PositiveSmallIntegerField(default=0)  # the order its chip shows in
    always_on = models.BooleanField(default=False)  # in play in every campaign: Mordheim (1a)

    class Meta:
        db_table = "campaign_type"
        ordering = ["sort_order", "name"]
        constraints = [models.CheckConstraint(check=models.Q(grade__in=GRADES), name="campaign_type_grade_valid")]

    def __str__(self):
        return self.name


class CampaignCampaignType(models.Model):
    campaign = models.ForeignKey(Campaign, related_name="campaign_type_links", on_delete=models.CASCADE)
    campaign_type = models.ForeignKey(CampaignType, related_name="campaign_links", on_delete=models.RESTRICT)

    class Meta:
        db_table = "campaign_campaign_type"
        constraints = [
            models.UniqueConstraint(fields=["campaign", "campaign_type"], name="unique_campaign_campaign_type")
        ]

    def __str__(self):
        return f"{self.campaign_id}:{self.campaign_type_id}"


class CampaignSettings(models.Model):
    campaign = models.OneToOneField(Campaign, related_name="settings", on_delete=models.CASCADE)
    # the campaign's catalogue: a new random value with every write to it, which retires its cached lists (PERF-13)
    catalogue_version = models.UUIDField(default=uuid.uuid4, editable=False)
    max_players = models.PositiveSmallIntegerField(default=8)
    max_heroes = models.PositiveSmallIntegerField(default=6)
    max_hired_swords = models.PositiveSmallIntegerField(default=3)
    max_games = models.PositiveSmallIntegerField(default=10)
    starting_gold = models.PositiveIntegerField(default=500)
    hero_level_thresholds = models.JSONField(default=get_default_hero_level_thresholds)
    henchmen_level_thresholds = models.JSONField(default=get_default_henchmen_level_thresholds)
    # hired swords level like henchmen until the campaign sets their own, so they get the same levels and gaps
    # (William, 12 Nov 2026), while rolling on the hero advance table (units/kinds.py)
    hired_sword_level_thresholds = models.JSONField(default=get_default_henchmen_level_thresholds)
    enable_encampments = models.BooleanField(default=False)
    enable_locations = models.BooleanField(default=False)
    hero_death_roll = models.CharField(
        max_length=10,
        choices=HERO_DEATH_ROLL_CHOICES,
        default="d66",
    )
    # the name of every warband's default resource (WarbandResource.is_default): a rename renames them all
    default_resource_name = models.CharField(max_length=120, default=DEFAULT_RESOURCE_NAME)
    # what selling shards of the default resource fetches, by shards and warband size (warbands/utils/wyrdstone_prices)
    wyrdstone_prices = models.JSONField(default=get_default_wyrdstone_prices)
    # "Plots and CP": each warband follows a plot and holds a campaign point total (apps/plots)
    enable_campaign_points = models.BooleanField(default=False)
    # Blood pacts (Mutiny in Marienburg's rule, which William calls generic, so any campaign may switch it on):
    # the post-game rolls 2D6 for each hired sword, and a pact-sworn one pays no upkeep
    enable_blood_pacts = models.BooleanField(default=False)
    # the post-game's exploration chart (apps/exploration): null is the book's Mordheim chart, a seeded row
    exploration_chart = models.ForeignKey(
        "exploration.ExplorationChart", related_name="+", null=True, blank=True, on_delete=models.SET_NULL
    )

    class Meta:
        db_table = "campaign_settings"

    def __str__(self):
        return f"Settings for {self.campaign_id}"
