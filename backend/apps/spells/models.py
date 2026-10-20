from django.db import models


class Spell(models.Model):
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="spells",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    campaign_type = models.ForeignKey(  # an add-on's entry (CAT-NEW-04: schema only, always null today)
        "campaigns.CampaignType", related_name="spells", null=True, blank=True, on_delete=models.RESTRICT
    )
    name = models.CharField(max_length=160)
    type = models.CharField(max_length=80, db_index=True)
    description = models.TextField(blank=True, default="")
    dc = models.CharField(max_length=40, blank=True, default="")
    roll = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        db_table = "spell"
        constraints = [  # one per name and type in the book, an add-on and a campaign (BUG-17, IMP-83)
            models.UniqueConstraint(
                fields=["campaign", "campaign_type", "name", "type"],
                name="spell_unique_name_type",
                nulls_distinct=False,
            )
        ]
        ordering = ["type", "name"]

    def __str__(self):
        return f"{self.name} ({self.type})"
