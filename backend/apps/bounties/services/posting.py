"""Posting a bounty and withdrawing it.

Posting holds no gold (it is soft): it warns when the poster's open bounties come to more than his warband holds,
and when the hero has already died or left, and posts anyway. Only the poster withdraws, while it is still open; the
claims still waiting close with it.
"""

from typing import Any

from django.db.models import Sum
from django.utils import timezone

from apps.campaigns.errors import CampaignError, field_error
from apps.warbands.models import Hero, Warband

from ..models import CLOSED, LIVE, MAX_NOTE, PENDING, WITHDRAWN, Bounty, BountyClaim

MAX_AMOUNT = 100_000
BountyWarning = dict[str, Any]  # {"code", "message"}: answered to the player who acted, never broadcast


def whole(data: Any, field: str, *, low: int, high: int) -> int:
    """A whole number from the body between `low` and `high`, else a 400 on the field."""
    raw = data.get(field) if isinstance(data, dict) else None
    if isinstance(raw, bool) or raw is None or not str(raw).strip().lstrip("-").isdigit():
        raise field_error(field, f"{field} must be a whole number.")
    value = int(str(raw).strip())
    if not low <= value <= high:
        raise field_error(field, f"{field} must be between {low} and {high}.")
    return value


def _note(data: Any) -> str:
    raw = data.get("note") if isinstance(data, dict) else None
    note = str(raw or "").strip()
    if len(note) > MAX_NOTE:
        raise field_error("note", f"A note has at most {MAX_NOTE} characters.")
    return note


def own_warband(campaign_id: int, user: Any, doing: str) -> Warband:
    """The player's warband in the campaign, else a 400 `no_warband` ("... to post a bounty")."""
    warband = Warband.objects.filter(campaign_id=campaign_id, user=user).first()
    if warband is None:
        raise CampaignError(f"You need a warband in this campaign {doing}.", code="no_warband")
    return warband


def gold_warning(poster: Warband) -> BountyWarning | None:
    """When the poster's open bounties come to more than his warband holds (one query)."""
    owed = Bounty.objects.filter(posted_by_warband=poster, status__in=LIVE).aggregate(total=Sum("amount"))["total"] or 0
    if owed <= poster.gold:
        return None
    return {
        "code": "gold_short",
        "message": f"Your open bounties come to {owed} gc and {poster.name} holds {poster.gold} gc. Gold moves only"
        " when a claim is accepted.",
    }


def gone_warning(hero: Hero) -> BountyWarning | None:
    name = hero.name or hero.unit_type
    if hero.dead:
        return {
            "code": "target_gone",
            "message": f"{name} is dead. The bounty stays open until it is claimed or withdrawn.",
        }
    if hero.dismissed_at:
        return {"code": "target_gone", "message": f"{name} has left the warband. The bounty stays open all the same."}
    return None


def post_bounty(campaign_id: int, user: Any, data: Any) -> tuple[Bounty, list[BountyWarning]]:
    """A new open bounty from the player's warband on another warband's hero, with its warnings."""
    poster = own_warband(campaign_id, user, "to post a bounty")
    hero_id = whole(data, "hero_id", low=1, high=2**31 - 1)
    amount = whole(data, "amount", low=1, high=MAX_AMOUNT)
    note = _note(data)
    hero = Hero.objects.select_related("warband").filter(id=hero_id, warband__campaign_id=campaign_id).first()
    if hero is None:
        raise CampaignError("No such hero in this campaign.", code="not_found", fields={"hero_id": ["Not found."]})
    if hero.warband_id == poster.id:
        raise CampaignError("You can't post a bounty on your own hero.", code="own_hero")
    bounty = Bounty.objects.create(
        campaign_id=campaign_id,
        target_hero=hero,
        target_name=hero.name or hero.unit_type,
        target_warband=hero.warband,
        target_warband_name=hero.warband.name,
        posted_by_warband=poster,
        posted_by_user=user,
        amount=amount,
        note=note,
    )
    warnings = [warning for warning in (gold_warning(poster), gone_warning(hero)) if warning]
    return bounty, warnings


def close_waiting_claims(bounty: Bounty, *, keep: BountyClaim | None = None) -> list[BountyClaim]:
    """Close the bounty's claims still waiting (but `keep`): the ones closed, read with their claimants."""
    waiting = BountyClaim.objects.select_for_update().filter(bounty=bounty, status=PENDING)
    if keep is not None:
        waiting = waiting.exclude(id=keep.id)
    closed = list(waiting.select_related("claimant_user", "claimant_warband"))
    now = timezone.now()
    for claim in closed:
        claim.status, claim.answered_at = CLOSED, now
    BountyClaim.objects.bulk_update(closed, ["status", "answered_at"])
    return closed


def withdraw_bounty(bounty: Bounty, user: Any) -> list[BountyClaim]:
    """The poster takes his bounty back while it is open; the claims that were waiting are closed and returned."""
    if user.id != bounty.posted_by_user_id:
        raise CampaignError("Only the player who posted a bounty can withdraw it.", code="not_poster", status=403)
    if not bounty.is_live:
        raise CampaignError("This bounty is no longer open.", code="bounty_closed", status=409)
    closed = close_waiting_claims(bounty)
    bounty.status, bounty.closed_at = WITHDRAWN, timezone.now()
    bounty.save(update_fields=["status", "closed_at", "updated_at"])
    return closed
