"""A campaign's locations (William, 23 Nov 2026): the places between games its warbands send heroes to.

A location belongs to a **group** (the Marketplace, The Undercity, Da Camp, the Wood Elf Glades), which is light, as a
skill group is: a name, a description, who may go there as text the player reads (nothing checks it) and its place.
A location is its rules as text, how many heroes go (a number, or every hero the warband has, so warbands of two
heroes and of six both read right), whether going spends each one's trading action, its own tables (a
`CampaignChart` owned by the location, shown inside it and never in the campaign's Tables list) and the campaign
tables it points to (`CampaignLocationChart`: Athel Loren's hazard tables).

Nothing is applied: a visit spends the trading actions it takes and writes one log line (warbands/services/
location_visits.py); fees, gold and finds are the player's own. Removing a group or a location is a soft delete.
"""

from django.conf import settings
from django.db import models

from .campaign import Campaign

MAX_LOCATION_RULES_TEXT = 8000  # as a campaign rule's


class CampaignLocationGroup(models.Model):
    campaign = models.ForeignKey(Campaign, related_name="location_groups", on_delete=models.CASCADE)
    name = models.CharField(max_length=160)
    description = models.TextField(max_length=4000, blank=True, default="")
    restrictions = models.TextField(max_length=4000, blank=True, default="")  # read by the player; nothing checks it
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # soft delete by a manage_locations holder: no longer listed, and its locations with it
    removed_at = models.DateTimeField(null=True, blank=True)
    removed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="+", on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = "campaign_location_group"
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return f"{self.campaign_id}:{self.name}"


class CampaignLocation(models.Model):
    """One place. `min_heroes` and `max_heroes` are a number, or null for every hero the warband has on its roster
    ("All"); with All the largest, min is never above max."""

    campaign = models.ForeignKey(Campaign, related_name="campaign_locations", on_delete=models.CASCADE)
    group = models.ForeignKey(CampaignLocationGroup, related_name="locations", on_delete=models.CASCADE)
    name = models.CharField(max_length=160)
    rules = models.TextField(max_length=MAX_LOCATION_RULES_TEXT, blank=True, default="")
    min_heroes = models.PositiveSmallIntegerField(null=True, blank=True, default=1)  # null: all of them
    max_heroes = models.PositiveSmallIntegerField(null=True, blank=True, default=1)  # null: all of them
    takes_trading_action = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # soft delete by a manage_locations holder: no longer listed
    removed_at = models.DateTimeField(null=True, blank=True)
    removed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="+", on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = "campaign_location"
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return f"{self.campaign_id}:{self.name}"


class CampaignLocationChart(models.Model):
    """A campaign table the location points to, in its order: the table stays the campaign's own, listed with the
    others, and the location shows a chip that opens it."""

    location = models.ForeignKey(CampaignLocation, related_name="chart_links", on_delete=models.CASCADE)
    chart = models.ForeignKey("campaigns.CampaignChart", related_name="location_links", on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "campaign_location_chart"
        ordering = ["order", "id"]
        constraints = [models.UniqueConstraint(fields=["location", "chart"], name="campaign_location_chart_unique")]

    def __str__(self) -> str:
        return f"{self.location_id}:{self.chart_id}"
