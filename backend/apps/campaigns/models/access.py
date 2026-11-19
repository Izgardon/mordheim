"""Who may do what in a campaign: the roles, the named permissions, the memberships and their overrides.

The rules that read these are `apps/campaigns/access.py` (one named rule per endpoint, deny by default); the
permission rows themselves are seeded by `campaigns/0003_seed_roles_and_permissions` from `constants.py`.
"""

from django.conf import settings
from django.db import models

from .campaign import ROLE_SLUGS, Campaign


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
