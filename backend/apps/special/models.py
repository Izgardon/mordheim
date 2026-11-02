from django.db import models

from apps.core.models import CatalogueEntry, version_constraints

from .kinds import KIND_CHOICES, TRAIT


class Special(CatalogueEntry):
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="specials",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    campaign_type = (
        models.ForeignKey(  # its setting, which holds its grade (grading phase 1); null counts as Mordheim's
            "campaigns.CampaignType", related_name="specials", null=True, blank=True, on_delete=models.RESTRICT
        )
    )
    name = models.CharField(max_length=160)
    type = models.CharField(max_length=80, db_index=True)
    description = models.TextField(max_length=4000, blank=True, default="")
    # Boons & Banes: whether it helps the unit (boon), holds it back (bane) or is neither (trait), set for the book's
    # from data/special-kinds.json (kinds.py)
    kind = models.CharField(max_length=5, choices=KIND_CHOICES, default=TRAIT)

    class Meta:
        db_table = "special"
        constraints = [
            *version_constraints("special"),
            # one per name and type in each setting of the book and in a campaign (BUG-17, IMP-83)
            models.UniqueConstraint(
                fields=["campaign", "campaign_type", "name", "type"],
                name="special_unique_name_type",
                nulls_distinct=False,
            ),
        ]
        ordering = ["type", "name"]

    def __str__(self):
        return f"{self.name} ({self.type})"
