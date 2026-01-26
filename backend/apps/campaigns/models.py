from django.conf import settings
from django.db import models

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


class Campaign(models.Model):
    campaign_type = models.ForeignKey(
        CampaignType,
        related_name="campaigns",
        on_delete=models.PROTECT,
        default=get_default_campaign_type_id,
    )
    name = models.CharField(max_length=120)
    join_code = models.CharField(max_length=6, unique=True)
    max_players = models.PositiveSmallIntegerField()
    max_games = models.PositiveSmallIntegerField(default=10)
    in_progress = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "campaign"

    def __str__(self):
        return self.name


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
