"""A campaign's encampments (William, 24 Nov 2026): the places its warbands hold, one of each in the campaign.

An encampment belongs to a **group** (Marienburg city, Outside the city; Sartosa's Port towns, Inland towns,
Wilderness), which is a name, a description and its place, as a location group is. An encampment is how it is
gained (a line the player reads: "Exploration 11111", "Seaside Situations 53"), whether it is fortified, what holding
it gives as text, and who holds it now: a warband, or nobody. A razed one is held by nobody until a warband takes it
again once it is rebuilt.

Nothing is applied: holding it changes no roll, gold or rating. The app records who holds what and whether it is
razed, and each change writes a line in the warbands' logs (services/encampment_holding.py). How encampments are held
is the campaign's encampment rules (`CampaignRule` of kind `encampment`). Removing a group or an encampment is a soft
delete.
"""

from django.conf import settings
from django.db import models

from .campaign import Campaign

MAX_ENCAMPMENT_TEXT = 8000  # as a campaign rule's


class CampaignEncampmentGroup(models.Model):
    campaign = models.ForeignKey(Campaign, related_name="encampment_groups", on_delete=models.CASCADE)
    name = models.CharField(max_length=160)
    description = models.TextField(max_length=4000, blank=True, default="")
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # soft delete by a manage_encampments holder: no longer listed, and its encampments with it
    removed_at = models.DateTimeField(null=True, blank=True)
    removed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="+", on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = "campaign_encampment_group"
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return f"{self.campaign_id}:{self.name}"


class CampaignEncampment(models.Model):
    """One place a warband may hold. `holder` is the warband holding it, null for nobody (and kept null when the
    warband is deleted); `razed` marks one burnt down, which nobody holds."""

    campaign = models.ForeignKey(Campaign, related_name="encampments", on_delete=models.CASCADE)
    group = models.ForeignKey(CampaignEncampmentGroup, related_name="encampments", on_delete=models.CASCADE)
    name = models.CharField(max_length=160)
    gained_by = models.CharField(max_length=200, blank=True, default="")
    fortified = models.BooleanField(default=False)
    text = models.TextField(max_length=MAX_ENCAMPMENT_TEXT, blank=True, default="")
    holder = models.ForeignKey(
        "warbands.Warband", related_name="encampments", on_delete=models.SET_NULL, null=True, blank=True
    )
    razed = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # soft delete by a manage_encampments holder: no longer listed
    removed_at = models.DateTimeField(null=True, blank=True)
    removed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="+", on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = "campaign_encampment"
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return f"{self.campaign_id}:{self.name}"
