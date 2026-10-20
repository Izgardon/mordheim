from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.warbands.utils.henchmen_level import HENCHMEN_LEVEL_THRESHOLDS
from apps.warbands.utils.hero_level import HERO_LEVEL_THRESHOLDS

ROLE_SLUGS = ["owner", "admin", "player"]
HERO_DEATH_ROLL_CHOICES = [
    ("d66", "D66"),
    ("d100", "D100"),
]


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

    class Meta:
        db_table = "campaign"

    def __str__(self):
        return self.name


class CampaignSettings(models.Model):
    campaign = models.OneToOneField(Campaign, related_name="settings", on_delete=models.CASCADE)
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
    item_settings = models.ManyToManyField(
        "restrictions.Restriction",
        related_name="campaign_settings",
        blank=True,
    )

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


class CampaignBulletinEntry(models.Model):
    campaign = models.ForeignKey(Campaign, related_name="bulletin_entries", on_delete=models.CASCADE)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="campaign_bulletin_entries",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    username = models.CharField(max_length=150)
    body = models.TextField(max_length=280)
    created_at = models.DateTimeField(auto_now_add=True)
    # soft delete (decision 8): the post stays listed as "removed" by an owner or admin, or by its author
    removed_at = models.DateTimeField(null=True, blank=True)
    removed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="+", on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = "campaign_bulletin"
        ordering = ["-id"]
        indexes = [models.Index(fields=["campaign", "-id"], name="campaign_bulletin_recent_idx")]  # PERF-45

    def __str__(self):
        return f"{self.campaign_id}:{self.user_id}:{self.created_at}"

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def clean(self):
        super().clean()
        self.username = str(self.username or "").strip()
        self.body = str(self.body or "").strip()
        if not self.body:
            raise ValidationError("Bulletin body is required.")
        if len(self.body) > 280:
            raise ValidationError("Bulletin body must be 280 characters or fewer.")


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
    content = models.TextField(blank=True, default="")
    d6_1 = models.TextField(blank=True, default="")
    d6_2 = models.TextField(blank=True, default="")
    d6_3 = models.TextField(blank=True, default="")
    d6_4 = models.TextField(blank=True, default="")
    d6_5 = models.TextField(blank=True, default="")
    d6_6 = models.TextField(blank=True, default="")

    class Meta:
        db_table = "campaign_location"
        ordering = ["name", "id"]

    def __str__(self):
        return f"{self.campaign_id}:{self.name}"


class PivotalMoment(models.Model):
    campaign = models.ForeignKey(Campaign, related_name="pivotal_moments", on_delete=models.CASCADE)
    battle = models.ForeignKey("battles.Battle", related_name="pivotal_moments", on_delete=models.CASCADE)
    warband = models.ForeignKey("warbands.Warband", related_name="pivotal_moments", on_delete=models.CASCADE)
    source_event = models.ForeignKey(
        "battles.BattleEvent",
        related_name="pivotal_moments",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    kind = models.CharField(max_length=64)
    headline = models.CharField(max_length=120)
    detail = models.TextField(blank=True)
    unit_key = models.CharField(max_length=64, null=True, blank=True)
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

    def __str__(self):
        return f"{self.campaign_id}:{self.battle_id}:{self.kind}"

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def clean(self):
        super().clean()
        if self.battle_id and self.battle.flow_type != "normal":
            raise ValidationError("Pivotal moments can only be created for normal battles.")
