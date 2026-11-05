import uuid
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.warbands.utils.henchmen_level import HENCHMEN_LEVEL_THRESHOLDS
from apps.warbands.utils.hero_level import HERO_LEVEL_THRESHOLDS

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
    # the settings in play: the ones its owner ticked, and the always-on ones (grading phase 1)
    campaign_types: models.ManyToManyField = models.ManyToManyField(
        "CampaignType", through="CampaignCampaignType", related_name="campaigns", blank=True
    )

    class Meta:
        db_table = "campaign"

    def __str__(self):
        return self.name


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

    class Meta:
        db_table = "campaign_settings"

    def __str__(self):
        return f"Settings for {self.campaign_id}"


class CampaignRole(models.Model):
    slug = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=40)

    class Meta:
        db_table = "campaign_role"
        constraints = [
            models.CheckConstraint(
                check=models.Q(slug__in=ROLE_SLUGS),
                name="campaign_role_slug_valid",
            )
        ]

    def __str__(self):
        return self.name


class CampaignPermission(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=80)

    class Meta:
        db_table = "campaign_permission"

    def __str__(self):
        return self.name


class CampaignMembership(models.Model):
    campaign = models.ForeignKey(Campaign, related_name="memberships", on_delete=models.CASCADE)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="campaign_memberships",
        on_delete=models.CASCADE,
    )
    role = models.ForeignKey(CampaignRole, related_name="memberships", on_delete=models.PROTECT)
    # the newest chat message he has read, on every device (CAMP-TWEAK-09); 0 before he has read any
    chat_last_read_id = models.BigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "campaign_membership"
        constraints = [models.UniqueConstraint(fields=["campaign", "user"], name="unique_campaign_membership")]

    def __str__(self):
        return f"{self.user_id}:{self.campaign_id}"


class CampaignMembershipPermission(models.Model):
    membership = models.ForeignKey(CampaignMembership, related_name="permissions", on_delete=models.CASCADE)
    permission = models.ForeignKey(
        CampaignPermission,
        related_name="membership_permissions",
        on_delete=models.CASCADE,
    )

    class Meta:
        db_table = "campaign_membership_permission"
        constraints = [
            models.UniqueConstraint(
                fields=["membership", "permission"],
                name="unique_campaign_membership_permission",
            )
        ]

    def __str__(self):
        return f"{self.membership_id}:{self.permission_id}"


class CampaignMessage(models.Model):
    campaign = models.ForeignKey(Campaign, related_name="messages", on_delete=models.CASCADE)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="campaign_messages",
        on_delete=models.SET_NULL,
        null=True,
    )
    username = models.CharField(max_length=150)
    body = models.TextField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)
    # soft delete (decision 8): the post stays listed as "removed" by an owner or admin, or by its author
    removed_at = models.DateTimeField(null=True, blank=True)
    removed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="+", on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = "campaign_message"
        ordering = ["-id"]
        indexes = [models.Index(fields=["campaign", "-id"], name="campaign_message_recent_idx")]  # PERF-45

    def __str__(self):
        return f"{self.campaign_id}:{self.user_id}:{self.created_at}"


class CampaignHouseRule(models.Model):
    campaign = models.ForeignKey(Campaign, related_name="house_rules", on_delete=models.CASCADE)
    title = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    effect_key = models.CharField(max_length=80, blank=True, null=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "campaign_house_rule"
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(  # one rule per item effect in a campaign (BUG-52)
                fields=["campaign", "effect_key"],
                condition=models.Q(effect_key__isnull=False) & ~models.Q(effect_key=""),
                name="campaign_house_rule_unique_effect",
            )
        ]

    def __str__(self):
        return f"{self.campaign_id}:{self.title}"


class CampaignEncampment(models.Model):
    campaign = models.ForeignKey(Campaign, related_name="encampments", on_delete=models.CASCADE)
    name = models.CharField(max_length=160)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="campaign_encampments",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    description = models.TextField(blank=True, default="")
    # soft delete by its owner or a manage_encampments holder: no longer listed (decision 9)
    removed_at = models.DateTimeField(null=True, blank=True)
    removed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="+", on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = "campaign_encampment"
        ordering = ["name", "id"]

    def __str__(self):
        return f"{self.campaign_id}:{self.name}"


class CampaignLocation(models.Model):
    campaign = models.ForeignKey(Campaign, related_name="campaign_locations", on_delete=models.CASCADE)
    name = models.CharField(max_length=160)
    area = models.CharField(max_length=80, blank=True, default="")  # free text: the panel filters by those in use
    content = models.TextField(blank=True, default="")
    d6_1 = models.TextField(blank=True, default="")
    d6_2 = models.TextField(blank=True, default="")
    d6_3 = models.TextField(blank=True, default="")
    d6_4 = models.TextField(blank=True, default="")
    d6_5 = models.TextField(blank=True, default="")
    d6_6 = models.TextField(blank=True, default="")
    # soft delete by a manage_locations holder: no longer listed (next step 7b)
    removed_at = models.DateTimeField(null=True, blank=True)
    removed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="+", on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = "campaign_location"
        ordering = ["name", "id"]

    def __str__(self):
        return f"{self.campaign_id}:{self.name}"


def _moment_unit(model: str) -> "models.ForeignKey[Any, Any]":
    return models.ForeignKey(model, related_name="pivotal_moments", on_delete=models.SET_NULL, null=True, blank=True)


MOMENT_UNIT_KINDS = ("hero", "henchman", "hireling")


class PivotalMoment(models.Model):
    """A headline the battle's fight left (apps/campaigns/pivotal_moments.py, next step 9). A kill moment carries
    its kill's round and points at it (`source_kill`); a result moment has neither. The unit it is about, when it
    is one of a warband's own (a hero, a henchman with his group, a hired sword), is kept as keys like battle_kill's
    killer, SET_NULL, with its name as it was."""

    campaign = models.ForeignKey(Campaign, related_name="pivotal_moments", on_delete=models.CASCADE)
    battle = models.ForeignKey("battles.Battle", related_name="pivotal_moments", on_delete=models.CASCADE)
    warband = models.ForeignKey("warbands.Warband", related_name="pivotal_moments", on_delete=models.CASCADE)
    source_kill = models.ForeignKey(
        "battles.BattleKill", related_name="pivotal_moments", on_delete=models.SET_NULL, null=True, blank=True
    )
    round = models.PositiveSmallIntegerField(null=True, blank=True)
    kind = models.CharField(max_length=64)
    headline = models.CharField(max_length=120)
    detail = models.TextField(blank=True)
    unit_kind = models.CharField(
        max_length=10, choices=[(kind, kind) for kind in MOMENT_UNIT_KINDS], null=True, blank=True
    )
    hero = _moment_unit("warbands.Hero")
    henchman = _moment_unit("warbands.Henchman")
    group = _moment_unit("warbands.HenchmenGroup")
    hireling = _moment_unit("warbands.Hireling")
    unit_name = models.CharField(max_length=120, null=True, blank=True)
    battle_ended_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "campaign_pivotal_moment"
        ordering = ["-battle_ended_at", "id"]
        indexes = [
            models.Index(fields=["campaign", "battle_ended_at"]),
            models.Index(fields=["battle", "warband"]),
            models.Index(fields=["kind"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(unit_kind__isnull=True, hero__isnull=True, henchman__isnull=True, group__isnull=True)
                & models.Q(hireling__isnull=True)
                | models.Q(unit_kind="hero", henchman__isnull=True, group__isnull=True, hireling__isnull=True)
                | models.Q(unit_kind="henchman", hero__isnull=True, hireling__isnull=True)
                | models.Q(unit_kind="hireling", hero__isnull=True, henchman__isnull=True, group__isnull=True),
                name="pivotal_moment_unit_keys",
            ),
        ]

    def __str__(self):
        return f"{self.campaign_id}:{self.battle_id}:{self.kind}"

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def clean(self):
        super().clean()
        if self.battle_id and self.battle.flow_type != "normal":
            raise ValidationError("Pivotal moments can only be created for normal battles.")
