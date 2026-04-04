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
    description = models.TextField(blank=True, default="")
    dc = models.CharField(max_length=40, blank=True, default="")
    roll = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        db_table = "spell"
        ordering = ["type", "name"]

    def __str__(self):
        return f"{self.name} ({self.type})"
