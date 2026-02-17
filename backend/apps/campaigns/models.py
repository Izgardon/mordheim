from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import models

from apps.warbands.utils.hero_level import HERO_LEVEL_THRESHOLDS
from apps.warbands.utils.henchmen_level import HENCHMEN_LEVEL_THRESHOLDS

ROLE_SLUGS = ["owner", "admin", "player"]


class CampaignType(models.Model):
    code = models.CharField(max_length=80, unique=True)
    name = models.CharField(max_length=120)

    class Meta:
        db_table = "campaign_type"

    def __str__(self):
        return self.name


def get_default_campaign_type_id():
    campaign_type, _ = CampaignType.objects.get_or_create(
        code="standard", defaults={"name": "Standard"}
    )
    return campaign_type.pk


def get_default_hero_level_thresholds():
    return list(HERO_LEVEL_THRESHOLDS)


def get_default_henchmen_level_thresholds():
    return list(HENCHMEN_LEVEL_THRESHOLDS)


class Campaign(models.Model):
    campaign_type = models.ForeignKey(
        CampaignType,
        related_name="campaigns",
        on_delete=models.PROTECT,
        default=get_default_campaign_type_id,
    )
    name = models.CharField(max_length=120)
    join_code = models.CharField(max_length=6, unique=True)
    in_progress = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "campaign"

    def __str__(self):
        return self.name

    def _get_settings_or_none(self):
        try:
            return self.settings
        except ObjectDoesNotExist:
            return None

    def _get_settings_value(self, field_name, default):
        settings_obj = self._get_settings_or_none()
        if not settings_obj:
            return default
        value = getattr(settings_obj, field_name, None)
        return default if value is None else value

    def _set_settings_value(self, field_name, value):
        settings_obj, _ = CampaignSettings.objects.get_or_create(campaign=self)
        setattr(settings_obj, field_name, value)
        settings_obj.save(update_fields=[field_name])

    @property
    def max_players(self):
        return self._get_settings_value("max_players", 8)

    @max_players.setter
    def max_players(self, value):
        self._set_settings_value("max_players", value)

    @property
    def max_heroes(self):
        return self._get_settings_value("max_heroes", 6)

    @max_heroes.setter
    def max_heroes(self, value):
        self._set_settings_value("max_heroes", value)

    @property
    def max_hired_swords(self):
        return self._get_settings_value("max_hired_swords", 3)

    @max_hired_swords.setter
    def max_hired_swords(self, value):
        self._set_settings_value("max_hired_swords", value)

    @property
    def max_games(self):
        return self._get_settings_value("max_games", 10)

    @max_games.setter
    def max_games(self, value):
        self._set_settings_value("max_games", value)

    @property
    def starting_gold(self):
        return self._get_settings_value("starting_gold", 500)

    @starting_gold.setter
    def starting_gold(self, value):
        self._set_settings_value("starting_gold", value)


class CampaignSettings(models.Model):
    campaign = models.OneToOneField(
        Campaign, related_name="settings", on_delete=models.CASCADE
    )
    max_players = models.PositiveSmallIntegerField(default=8)
    max_heroes = models.PositiveSmallIntegerField(default=6)
    max_hired_swords = models.PositiveSmallIntegerField(default=3)
    max_games = models.PositiveSmallIntegerField(default=10)
    starting_gold = models.PositiveIntegerField(default=500)
    hero_level_thresholds = models.JSONField(default=get_default_hero_level_thresholds)
    henchmen_level_thresholds = models.JSONField(default=get_default_henchmen_level_thresholds)
    hired_sword_level_thresholds = models.JSONField(default=get_default_henchmen_level_thresholds)

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
    campaign = models.ForeignKey(
        Campaign, related_name="memberships", on_delete=models.CASCADE
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="campaign_memberships",
        on_delete=models.CASCADE,
    )
    role = models.ForeignKey(
        CampaignRole, related_name="memberships", on_delete=models.PROTECT
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "campaign_membership"
        constraints = [
            models.UniqueConstraint(
                fields=["campaign", "user"], name="unique_campaign_membership"
            )
        ]

    def __str__(self):
        return f"{self.user_id}:{self.campaign_id}"


class CampaignMembershipPermission(models.Model):
    membership = models.ForeignKey(
        CampaignMembership, related_name="permissions", on_delete=models.CASCADE
    )
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


class CampaignHouseRule(models.Model):
    campaign = models.ForeignKey(
        Campaign, related_name="house_rules", on_delete=models.CASCADE
    )
    title = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "campaign_house_rule"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.campaign_id}:{self.title}"
