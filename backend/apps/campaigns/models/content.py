"""The campaign's own content: its messages, house rules, campaign, battle and encampment rules and the pivotal
moments its battles left. Its charts are `charts.py`, its locations `locations.py`, its encampments `encampments.py`.
"""

from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from .campaign import Campaign


class CampaignMessage(models.Model):
    campaign = models.ForeignKey(Campaign, related_name="messages", on_delete=models.CASCADE)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="campaign_messages",
        on_delete=models.SET_NULL,
        null=True,
    )
    username = models.CharField(max_length=150)
    body = models.TextField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)
    # soft delete (decision 8): the post stays listed as "removed" by an owner or admin, or by its author
    removed_at = models.DateTimeField(null=True, blank=True)
    removed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="+", on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = "campaign_message"
        ordering = ["-id"]
        indexes = [models.Index(fields=["campaign", "-id"], name="campaign_message_recent_idx")]  # PERF-45

    def __str__(self):
        return f"{self.campaign_id}:{self.user_id}:{self.created_at}"


class CampaignHouseRule(models.Model):
    campaign = models.ForeignKey(Campaign, related_name="house_rules", on_delete=models.CASCADE)
    title = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    effect_key = models.CharField(max_length=80, blank=True, null=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "campaign_house_rule"
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(  # one rule per item effect in a campaign (BUG-52)
                fields=["campaign", "effect_key"],
                condition=models.Q(effect_key__isnull=False) & ~models.Q(effect_key=""),
                name="campaign_house_rule_unique_effect",
            )
        ]

    def __str__(self):
        return f"{self.campaign_id}:{self.title}"


MAX_CAMPAIGN_RULE_TEXT = 8000  # as a warband rule's (warbands/models/warband.py MAX_RULE_TEXT)
# What a rule is about (William, 19 Nov 2026). A battle rule only matters while a game is being set up or played
# (the weather, the ground, an encounter being triggered); a campaign rule is about the campaign between games. Both
# are the same thing to write, read and order, so they are one table and one set of code, told apart by this. An
# encampment rule is how encampments are held (William, 24 Nov 2026): the Encampments page shows it, the Rules page
# never does.
CAMPAIGN_RULE_KINDS = (("campaign", "Campaign rule"), ("battle", "Battle rule"), ("encampment", "Encampment rule"))
ENCAMPMENT_RULE = "encampment"
RULE_KIND_LENGTH = 10


class CampaignRule(models.Model):
    """One of the campaign's own rules, not a house rule (William, 7 Nov 2026: "campaign wide rules that are not house
    rules, kind of like warband rules ... admin only", "more flavourful rulings on how the campaign works"): a title,
    its body, and its place in the list. Its owner and admins write and order them; every member reads them.

    `umbrella` is the heading clearly related rules share (William, 19 Nov 2026: "one modal for all shared rules"):
    the rules naming the same umbrella show as one row and open together, and a blank umbrella stands alone."""

    campaign = models.ForeignKey(Campaign, related_name="campaign_rules", on_delete=models.CASCADE)
    kind = models.CharField(max_length=RULE_KIND_LENGTH, choices=CAMPAIGN_RULE_KINDS, default="campaign")
    title = models.CharField(max_length=160)
    body = models.TextField(blank=True, default="")
    umbrella = models.CharField(max_length=120, blank=True, default="")
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "campaign_rule"
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.campaign_id}:{self.title}"


def _moment_unit(model: str) -> "models.ForeignKey[Any, Any]":
    return models.ForeignKey(model, related_name="pivotal_moments", on_delete=models.SET_NULL, null=True, blank=True)


MOMENT_UNIT_KINDS = ("hero", "henchman", "hireling")


class PivotalMoment(models.Model):
    """A headline the battle's fight left (apps/campaigns/pivotal_moments.py, next step 9). A kill moment carries
    its kill's round and points at it (`source_kill`); a result moment has neither. The unit it is about, when it
    is one of a warband's own (a hero, a henchman with his group, a hired sword), is kept as keys like battle_kill's
    killer, SET_NULL, with its name as it was."""

    campaign = models.ForeignKey(Campaign, related_name="pivotal_moments", on_delete=models.CASCADE)
    battle = models.ForeignKey("battles.Battle", related_name="pivotal_moments", on_delete=models.CASCADE)
    warband = models.ForeignKey("warbands.Warband", related_name="pivotal_moments", on_delete=models.CASCADE)
    source_kill = models.ForeignKey(
        "battles.BattleKill", related_name="pivotal_moments", on_delete=models.SET_NULL, null=True, blank=True
    )
    round = models.PositiveSmallIntegerField(null=True, blank=True)
    kind = models.CharField(max_length=64)
    headline = models.CharField(max_length=120)
    detail = models.TextField(blank=True)
    unit_kind = models.CharField(
        max_length=10, choices=[(kind, kind) for kind in MOMENT_UNIT_KINDS], null=True, blank=True
    )
    hero = _moment_unit("warbands.Hero")
    henchman = _moment_unit("warbands.Henchman")
    group = _moment_unit("warbands.HenchmenGroup")
    hireling = _moment_unit("warbands.Hireling")
    unit_name = models.CharField(max_length=120, null=True, blank=True)
    battle_ended_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "campaign_pivotal_moment"
        ordering = ["-battle_ended_at", "id"]
        indexes = [
            models.Index(fields=["campaign", "battle_ended_at"]),
            models.Index(fields=["battle", "warband"]),
            models.Index(fields=["kind"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(unit_kind__isnull=True, hero__isnull=True, henchman__isnull=True, group__isnull=True)
                & models.Q(hireling__isnull=True)
                | models.Q(unit_kind="hero", henchman__isnull=True, group__isnull=True, hireling__isnull=True)
                | models.Q(unit_kind="henchman", hero__isnull=True, hireling__isnull=True)
                | models.Q(unit_kind="hireling", hero__isnull=True, henchman__isnull=True, group__isnull=True),
                name="pivotal_moment_unit_keys",
            ),
        ]

    def __str__(self):
        return f"{self.campaign_id}:{self.battle_id}:{self.kind}"

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def clean(self):
        super().clean()
        if self.battle_id and self.battle.flow_type != "normal":
            raise ValidationError("Pivotal moments can only be created for normal battles.")
