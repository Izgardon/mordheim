from django.db import models


class Spell(models.Model):
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="spells",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=160)
    type = models.CharField(max_length=80, db_index=True)
    description = models.TextField(max_length=500, blank=True, default="")
    dc = models.CharField(max_length=40, blank=True, default="")
    roll = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        db_table = "spell"
        ordering = ["type", "name"]

    def __str__(self):
        return f"{self.name} ({self.type})"


class SpellCampaignType(models.Model):
    campaign_type = models.ForeignKey(
        "campaigns.CampaignType",
        related_name="spell_links",
        on_delete=models.CASCADE,
    )
    spell = models.ForeignKey(
        Spell, related_name="campaign_types", on_delete=models.CASCADE
    )

    class Meta:
        db_table = "spell_campaign_type"
        constraints = [
            models.UniqueConstraint(
                fields=["campaign_type", "spell"], name="unique_spell_campaign_type"
            )
        ]

    def __str__(self):
        return f"{self.campaign_type_id}:{self.spell_id}"
