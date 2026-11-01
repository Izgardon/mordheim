"""Bounties (William, 2026-10-25 and 2026-10-28): a player puts gold on an enemy hero, and whoever takes him out claims it.

A bounty is soft: no gold is held when it is posted, and it moves only when a claim is accepted by both sides (the
claimant's side is accepted when he claims; the poster accepts or declines his). Several bounties may stand on the
same hero, and several claims may compete for one; the first accepted is paid and the others close. A bounty stays
open until it is paid or its poster withdraws it, whatever becomes of the hero, so the target is SET_NULL with his
name and warband saved at the time.
"""

from typing import Any

from django.conf import settings
from django.db import models
from django.db.models import Q

OPEN, CLAIMED, PAID, WITHDRAWN = "open", "claimed", "paid", "withdrawn"
LIVE = (OPEN, CLAIMED)  # still to be paid: "Open bounties"
PENDING, DECLINED, CLOSED = "pending", "declined", "closed"  # a claim's own states (PAID and WITHDRAWN too)
HERO, HENCHMAN, HIRELING = "hero", "henchman", "hireling"
UNIT_KINDS = (HERO, HENCHMAN, HIRELING)
MAX_NOTE = 500


def _set_null(model: str, related_name: str) -> "models.ForeignKey[Any, Any]":
    return models.ForeignKey(model, related_name=related_name, on_delete=models.SET_NULL, null=True, blank=True)


class Bounty(models.Model):
    STATUSES = ((OPEN, "Open"), (CLAIMED, "Claimed"), (PAID, "Paid"), (WITHDRAWN, "Withdrawn"))

    campaign = models.ForeignKey("campaigns.Campaign", related_name="bounties", on_delete=models.CASCADE)
    target_hero = _set_null("warbands.Hero", "bounties")
    target_name = models.CharField(max_length=120)
    target_warband = _set_null("warbands.Warband", "bounties_on")
    target_warband_name = models.CharField(max_length=120)
    posted_by_warband = models.ForeignKey("warbands.Warband", related_name="bounties_posted", on_delete=models.CASCADE)
    posted_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="bounties_posted", on_delete=models.CASCADE
    )
    amount = models.PositiveIntegerField()
    note = models.CharField(max_length=MAX_NOTE, blank=True, default="")
    status = models.CharField(max_length=12, choices=STATUSES, default=OPEN)
    # the claim that was paid (set with status "paid"): the chronicle and the list read it with the bounty
    paid_claim = models.OneToOneField("BountyClaim", related_name="+", on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)  # paid or withdrawn

    class Meta:
        db_table = "bounty"
        indexes = [models.Index(fields=["campaign", "status"], name="bounty_campaign_status_idx")]
        constraints = [
            models.CheckConstraint(check=Q(amount__gt=0), name="bounty_amount_positive"),
            models.CheckConstraint(check=Q(status__in=(OPEN, CLAIMED, PAID, WITHDRAWN)), name="bounty_status"),
            models.CheckConstraint(
                check=Q(status__in=LIVE, closed_at__isnull=True)
                | Q(status__in=(PAID, WITHDRAWN), closed_at__isnull=False),
                name="bounty_closed_at",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.campaign_id}:{self.id} {self.amount} gc on {self.target_name} ({self.status})"

    @property
    def is_live(self) -> bool:
        return self.status in LIVE


class BountyClaim(models.Model):
    """One player's claim on a bounty: which of his units took the hero out, and optionally the kill and the battle.

    The unit is kept as keys like battle_kill's killer (a hero, a henchman with his group, or the group alone, a hired
    sword), SET_NULL, with the name as it was. Each side accepts its own part; when both have, the gold moves."""

    STATUSES = (
        (PENDING, "Pending"),
        (PAID, "Paid"),
        (DECLINED, "Declined"),  # by the poster
        (WITHDRAWN, "Withdrawn"),  # by the claimant
        (CLOSED, "Closed"),  # the bounty was paid to another claim, or withdrawn
    )

    bounty = models.ForeignKey(Bounty, related_name="claims", on_delete=models.CASCADE)
    claimant_warband = models.ForeignKey("warbands.Warband", related_name="bounty_claims", on_delete=models.CASCADE)
    claimant_user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="bounty_claims", on_delete=models.CASCADE)
    unit_kind = models.CharField(max_length=10, choices=[(kind, kind) for kind in UNIT_KINDS])
    hero = _set_null("warbands.Hero", "bounty_claims")
    henchman = _set_null("warbands.Henchman", "bounty_claims")
    group = _set_null("warbands.HenchmenGroup", "bounty_claims")
    hireling = _set_null("warbands.Hireling", "bounty_claims")
    unit_name = models.CharField(max_length=120)
    kill = _set_null("battles.BattleKill", "bounty_claims")
    battle = _set_null("battles.Battle", "bounty_claims")
    status = models.CharField(max_length=12, choices=STATUSES, default=PENDING)
    poster_accepted = models.BooleanField(default=False)
    claimant_accepted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    answered_at = models.DateTimeField(null=True, blank=True)  # paid, declined, withdrawn or closed

    class Meta:
        db_table = "bounty_claim"
        constraints = [
            models.CheckConstraint(
                check=Q(unit_kind=HERO, henchman__isnull=True, group__isnull=True, hireling__isnull=True)
                | Q(unit_kind=HENCHMAN, hero__isnull=True, hireling__isnull=True)
                | Q(unit_kind=HIRELING, hero__isnull=True, henchman__isnull=True, group__isnull=True),
                name="bounty_claim_unit_keys",
            ),
            models.CheckConstraint(
                check=Q(status__in=(PENDING, PAID, DECLINED, WITHDRAWN, CLOSED)), name="bounty_claim_status"
            ),
            # one claim at a time per warband, and one paid claim per bounty
            models.UniqueConstraint(
                fields=["bounty", "claimant_warband"],
                condition=Q(status=PENDING),
                name="bounty_claim_one_pending_per_warband",
            ),
            models.UniqueConstraint(fields=["bounty"], condition=Q(status=PAID), name="bounty_claim_one_paid"),
        ]

    def __str__(self) -> str:
        return f"{self.bounty_id}:{self.id} by {self.claimant_warband_id} ({self.status})"
