from django.db import models


class Skill(models.Model):
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="skills",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=160)
    type = models.CharField(max_length=80, db_index=True)
    description = models.TextField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "skill"
        ordering = ["type", "name"]

    def __str__(self):
        return f"{self.name} ({self.type})"


class SkillCampaignType(models.Model):
    campaign_type = models.ForeignKey(
        "campaigns.CampaignType",
        related_name="skill_links",
        on_delete=models.CASCADE,
    )
    skill = models.ForeignKey(
        Skill, related_name="campaign_types", on_delete=models.CASCADE
    )

    class Meta:
        db_table = "skill_campaign_type"
        constraints = [
            models.UniqueConstraint(
                fields=["campaign_type", "skill"], name="unique_skill_campaign_type"
            )
        ]

    def __str__(self):
        return f"{self.campaign_type_id}:{self.skill_id}"
