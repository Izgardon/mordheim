from django.db import models


class Item(models.Model):
    name = models.CharField(max_length=140)
    type = models.CharField(max_length=80, db_index=True)
    cost = models.CharField(max_length=50)
    availability = models.CharField(max_length=40)
    unique_to = models.CharField(max_length=200, blank=True)
    custom = models.BooleanField(default=False)

    class Meta:
        db_table = "item"
        ordering = ["type", "name"]

    def __str__(self):
        return f"{self.name} ({self.type})"
