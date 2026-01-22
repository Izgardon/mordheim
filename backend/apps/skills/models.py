from django.db import models


class Skill(models.Model):
    name = models.CharField(max_length=120)
    type = models.CharField(max_length=80, db_index=True)
    description = models.TextField(blank=True)
    custom = models.BooleanField(default=False)

    class Meta:
        db_table = "skill"
        ordering = ["type", "name"]

    def __str__(self):
        return f"{self.name} ({self.type})"
