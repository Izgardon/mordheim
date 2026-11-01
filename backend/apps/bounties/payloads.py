"""What a bounty reads as: the list's rows, the answers to writes and `bounty.changed` share one shape, with nothing
of the reader's own in it (the list adds the reader's warband beside the rows)."""

from typing import Any

from apps.campaigns.selectors import format_short_date
from apps.users.names import display_name

from .models import HENCHMAN, HERO, HIRELING, Bounty, BountyClaim

# a claim's unit as its warband page's card (`?unit=<kind>-<id>`): a henchman opens his group's
UNIT_CARDS = {
    HERO: ("hero", "hero_id"),
    HENCHMAN: ("henchmen_group", "group_id"),
    HIRELING: ("hireling", "hireling_id"),
}


def target_gone(bounty: Bounty) -> str | None:
    """Why the hero is no longer on his warband's roster ("dead", "dismissed", "removed" once his row is gone),
    None while he is: the bounty stays open either way, and the page says so."""
    hero = bounty.target_hero
    if hero is None:
        return "removed"
    if hero.dead:
        return "dead"
    return "dismissed" if hero.dismissed_at else None


def _unit(claim: BountyClaim) -> dict[str, Any] | None:
    card, field = UNIT_CARDS[claim.unit_kind]
    unit_id = getattr(claim, field)
    return {"kind": card, "id": unit_id, "name": claim.unit_name} if unit_id else None


def claim_payload(claim: BountyClaim) -> dict[str, Any]:
    battle = claim.battle
    return {
        "id": claim.id,
        "status": claim.status,
        "warband_id": claim.claimant_warband_id,
        "warband_name": claim.claimant_warband.name,
        "user_id": claim.claimant_user_id,
        "user_name": display_name(claim.claimant_user),
        "unit_name": claim.unit_name,
        "unit": _unit(claim),
        "kill_id": claim.kill_id,
        "battle": (
            {
                "id": battle.id,
                "scenario": battle.scenario,
                "date": format_short_date(battle.ended_at or battle.created_at),
            }
            if battle
            else None
        ),
        "poster_accepted": claim.poster_accepted,
        "claimant_accepted": claim.claimant_accepted,
        "created_at": claim.created_at.isoformat(),
        "answered_at": claim.answered_at.isoformat() if claim.answered_at else None,
    }


def bounty_payload(bounty: Bounty, claims: list[BountyClaim] | None = None) -> dict[str, Any]:
    """The bounty with its claims, oldest first (read with `selectors.with_claims`, or passed in)."""
    hero, target_warband, poster = bounty.target_hero, bounty.target_warband, bounty.posted_by_warband
    rows = claims if claims is not None else list(bounty.claims.all())
    return {
        "id": bounty.id,
        "campaign_id": bounty.campaign_id,
        "status": bounty.status,
        "amount": bounty.amount,
        "note": bounty.note,
        "target": {
            "hero_id": bounty.target_hero_id,
            "name": bounty.target_name,
            "is_leader": bool(hero and hero.is_leader),
            "gone": target_gone(bounty),
            "warband_id": bounty.target_warband_id,
            "warband_name": target_warband.name if target_warband else bounty.target_warband_name,
            "user_id": target_warband.user_id if target_warband else None,
        },
        "posted_by": {
            "warband_id": poster.id,
            "warband_name": poster.name,
            "user_id": bounty.posted_by_user_id,
            "user_name": display_name(bounty.posted_by_user),
        },
        "paid_claim_id": bounty.paid_claim_id,
        "created_at": bounty.created_at.isoformat(),
        "closed_at": bounty.closed_at.isoformat() if bounty.closed_at else None,
        "claims": [claim_payload(claim) for claim in sorted(rows, key=lambda row: (row.created_at, row.id))],
    }


def claim_notice(bounty: Bounty, claim: BountyClaim) -> dict[str, Any]:
    """The poster's `bounty_claim` notification: who claims which bounty, with which unit, in which battle."""
    return {
        "bounty_id": bounty.id,
        "claim_id": claim.id,
        "campaign_id": bounty.campaign_id,
        "amount": bounty.amount,
        "target_name": bounty.target_name,
        "target_warband_name": bounty.target_warband_name,
        "claimant_user_name": display_name(claim.claimant_user),
        "claimant_warband_name": claim.claimant_warband.name,
        "unit_name": claim.unit_name,
        "battle_scenario": claim.battle.scenario if claim.battle else None,
        "created_at": claim.created_at.isoformat(),
    }
