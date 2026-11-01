"""The bounties' reads: the campaign's open bounties (a fixed number of queries whatever their count), the heroes a
bounty can be posted on, and one bounty locked for a write."""

from typing import Any

from django.db.models import CharField, Prefetch, QuerySet
from django.db.models.functions import Cast

from apps.campaigns.errors import CampaignError
from apps.users.names import display_name
from apps.warbands.models import Hero, Warband, on_roster

from .models import LIVE, PENDING, Bounty, BountyClaim


def with_claims(rows: QuerySet[Bounty]) -> QuerySet[Bounty]:
    """Bounties read with everything their payload shows: two queries for any number of them."""
    claims = BountyClaim.objects.select_related("claimant_warband", "claimant_user", "battle")
    return rows.select_related("target_hero", "target_warband", "posted_by_warband", "posted_by_user").prefetch_related(
        Prefetch("claims", queryset=claims)
    )


def live_bounties(campaign_id: int) -> QuerySet[Bounty]:
    """The campaign's bounties still to be paid (open, or with a claim waiting), newest first."""
    rows = Bounty.objects.filter(campaign_id=campaign_id, status__in=LIVE).order_by("-created_at", "-id")
    return with_claims(rows)


def viewer_warband(campaign_id: int, user: Any) -> Warband | None:
    """The reader's warband in the campaign (his gold too), None when he has none."""
    return Warband.objects.filter(campaign_id=campaign_id, user=user).only("id", "name", "gold", "user_id").first()


def warband_ref(warband: Warband | None) -> dict[str, Any] | None:
    return {"id": warband.id, "name": warband.name, "gold": warband.gold} if warband else None


def bounty_targets(campaign_id: int, viewer: Warband | None) -> list[dict[str, Any]]:
    """Every other warband's heroes on its roster, by warband (Post a bounty from the overview): one query."""
    heroes = on_roster(Hero.objects.filter(warband__campaign_id=campaign_id)).select_related("warband__user")
    if viewer is not None:
        heroes = heroes.exclude(warband_id=viewer.id)
    by_warband: dict[int, dict[str, Any]] = {}
    for hero in heroes.order_by("warband__name", "warband_id", "-is_leader", "name", "id"):
        warband = hero.warband
        entry = by_warband.setdefault(
            warband.id,
            {
                "warband_id": warband.id,
                "warband_name": warband.name,
                "user_name": display_name(warband.user),
                "heroes": [],
            },
        )
        entry["heroes"].append(
            {
                "id": hero.id,
                "name": hero.name or hero.unit_type,
                "unit_type": hero.unit_type,
                "is_leader": hero.is_leader,
            }
        )
    return list(by_warband.values())


def locked_bounty(campaign_id: int, bounty_id: int) -> Bounty:
    """The bounty under its row lock, read with its payload's relations (404 when the campaign has no such bounty)."""
    found = (
        Bounty.objects.select_for_update(of=("self",))
        .select_related("target_hero", "target_warband", "posted_by_warband", "posted_by_user")
        .filter(campaign_id=campaign_id, id=bounty_id)
        .first()
    )
    if found is None:
        raise CampaignError("Not found", code="not_found", status=404)
    return found


def bounty_claims(bounty: Bounty) -> list[BountyClaim]:
    """Its claims with what their payload shows (one query)."""
    return list(BountyClaim.objects.filter(bounty=bounty).select_related("claimant_warband", "claimant_user", "battle"))


def waiting_claim_refs() -> QuerySet[Any, dict[str, Any]]:
    """The ids of every claim still waiting, as notification references (a subquery: no query of its own)."""
    waiting = BountyClaim.objects.filter(status=PENDING)
    return waiting.annotate(ref=Cast("id", output_field=CharField())).values("ref")
