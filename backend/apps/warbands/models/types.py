"""Warband types and warband groups (grading phase 1), seeded from the catalogue import by `seed_warband_types`.

A warband type is a kind of warband from the lists (Reiklanders, Skaven of Clan Eshin …): the book's 164 come from
Broheim's tables merged with mordheimer's index, each in one setting (`campaign_type`, which holds its grade). A
campaign can add its own (custom: `campaign` set, no setting, so always in play there), and every player in it can
pick them. A warband has one type and may count as others (`Warband.counts_as`). A warband group is a race or a side
(Humans, Skaven; Chaos, Good) holding any number of types: who may buy an item or hire a sword names types or groups
(the items rebuild).
"""

from django.conf import settings
from django.db import models
from django.db.models.functions import Lower

GROUP_KINDS = [("race", "Race"), ("side", "Side")]


class WarbandType(models.Model):
    campaign = models.ForeignKey(
        "campaigns.Campaign", related_name="warband_types", null=True, blank=True, on_delete=models.CASCADE
    )  # null: the book's list
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140)
    campaign_type = models.ForeignKey(  # its setting, which holds its grade; null for a campaign's own
        "campaigns.CampaignType", related_name="warband_types", null=True, blank=True, on_delete=models.RESTRICT
    )
    race = models.CharField(max_length=80, blank=True, default="")
    source = models.CharField(max_length=120, blank=True, default="")  # "Town Cryer 10"
    source_code = models.CharField(max_length=20, blank=True, default="")  # "TC11", "LUS": tells same names apart
    link_url = models.URLField(max_length=500, blank=True, default="")  # mordheimer's page, else Broheim's PDF
    # the two sites' own grades, as text for the source line only: the setting holds the grade that counts
    broheim_grade = models.CharField(max_length=8, blank=True, default="")
    mordheimer_grade = models.CharField(max_length=8, blank=True, default="")
    archived_at = models.DateTimeField(null=True, blank=True)  # gone from the import, or a custom type retired
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="+", null=True, blank=True, on_delete=models.SET_NULL
    )  # who added a campaign's own type
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "warband_type"
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(fields=["campaign", "slug"], name="warband_type_unique_slug", nulls_distinct=False),
            models.UniqueConstraint(  # a campaign names its own types once (the book repeats a few names)
                Lower("name"),
                "campaign",
                condition=models.Q(campaign__isnull=False),
                name="warband_type_unique_custom_name",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class WarbandGroup(models.Model):
    slug = models.SlugField(max_length=40, unique=True)
    name = models.CharField(max_length=80)
    kind = models.CharField(max_length=10, choices=GROUP_KINDS)
    sort_order = models.PositiveSmallIntegerField(default=0)
    members = models.ManyToManyField(WarbandType, related_name="groups", blank=True, db_table="warband_group_member")

    class Meta:
        db_table = "warband_group"
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name


class WarbandAccess(models.Model):
    """One line of a who-can list (the items rebuild): a warband type or a warband group, may (`excluded` off) or may
    not. A price row says who may buy it with these lines, a hired sword or dramatis persona who may hire him, a
    skill group who may learn from it; each owner also says whether it is for everyone (minus the excluded). Read by
    `warbands/services/who_can.py`."""

    warband_type = models.ForeignKey(WarbandType, related_name="+", null=True, blank=True, on_delete=models.CASCADE)
    warband_group = models.ForeignKey(WarbandGroup, related_name="+", null=True, blank=True, on_delete=models.CASCADE)
    excluded = models.BooleanField(default=False)

    class Meta:
        abstract = True


def access_constraints(prefix: str) -> list[models.BaseConstraint]:
    """A who-can line names a type or a group, never both."""
    return [
        models.CheckConstraint(
            check=models.Q(warband_type__isnull=False, warband_group__isnull=True)
            | models.Q(warband_type__isnull=True, warband_group__isnull=False),
            name=f"{prefix}_type_or_group",
        )
    ]
