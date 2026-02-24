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


