"""Claiming a bounty, and each side answering its part of a claim.

The claimant says which of his units took the hero out, and optionally the kill and the battle: a kill from the
suggestions fills in its killer and its battle. Claiming accepts the claimant's part; the poster accepts his (the gold
moves, `payment.pay`) or declines, and the claimant can take his claim back. A claim with nothing on record behind it
warns and stands: the poster decides.
"""

from typing import Any

from django.utils import timezone

from apps.battles.models import Battle, BattleKill
from apps.campaigns.errors import CampaignError, field_error
from apps.warbands.models import HenchmenGroup, Hero, Hireling, Warband, not_dismissed

from ..candidates import has_record, kill_candidates
from ..models import CLAIMED, DECLINED, HENCHMAN, HERO, HIRELING, OPEN, PAID, PENDING, WITHDRAWN, Bounty, BountyClaim
from .posting import BountyWarning, own_warband, whole

# the unit a request names: {"kind", "id"} (a henchmen group's card names the group, a kill its henchman)
UNIT_MODELS: dict[str, tuple[str, Any]] = {
    "hero": (HERO, Hero),
    "henchmen_group": (HENCHMAN, HenchmenGroup),
    "hireling": (HIRELING, Hireling),
}


def _open(bounty: Bounty) -> None:
    if not bounty.is_live:
        raise CampaignError("This bounty is no longer open.", code="bounty_closed", status=409)


def _claimant(bounty: Bounty, user: Any) -> Warband:
    warband = own_warband(bounty.campaign_id, user, "to claim a bounty")
    if warband.id == bounty.posted_by_warband_id:
        raise CampaignError("You posted this bounty.", code="own_bounty")
    if warband.id == bounty.target_warband_id:
        raise CampaignError("This bounty is on your own hero.", code="own_hero")
    waiting = BountyClaim.objects.filter(bounty=bounty, claimant_warband=warband, status=PENDING).first()
    if waiting is not None:
        raise CampaignError(
            "You have already claimed this bounty: wait for the answer, or take that claim back.",
            code="claim_pending",
            status=409,
            claim_id=waiting.id,
        )
    return warband


def _kill(bounty: Bounty, warband: Warband, data: Any) -> BattleKill | None:
    if not isinstance(data, dict) or data.get("kill_id") in (None, ""):
        return None
    kill_id = whole(data, "kill_id", low=1, high=2**63 - 1)
    kill = kill_candidates(bounty, warband.id).filter(id=kill_id).first()
    if kill is None:
        raise field_error(
            "kill_id", f"That isn't one of your kills of {bounty.target_name} since the bounty was posted."
        )
    return kill


def _unit_from_kill(claim: BountyClaim, kill: BattleKill) -> None:
    claim.unit_kind = kill.killer_kind
    claim.hero_id, claim.henchman_id = kill.killer_hero_id, kill.killer_henchman_id
    claim.group_id, claim.hireling_id = kill.killer_group_id, kill.killer_hireling_id
    claim.unit_name = kill.killer_called(start=True)


def _unit(claim: BountyClaim, warband: Warband, raw: Any) -> None:
    """The unit the request names, one of the claimant's own still in his warband (a 400 on `unit` otherwise)."""
    kind = raw.get("kind") if isinstance(raw, dict) else None
    if kind not in UNIT_MODELS:
        raise field_error("unit", "Name the unit that took him out: a hero, a henchmen group or a hired sword.")
    unit_kind, model = UNIT_MODELS[kind]
    unit_id = whole(raw, "id", low=1, high=2**63 - 1)
    unit = not_dismissed(model.objects.filter(id=unit_id, warband_id=warband.id)).first()
    if unit is None:
        raise field_error("unit", "That unit isn't one of yours.")
    claim.unit_kind, claim.unit_name = unit_kind, unit.name or unit.unit_type
    claim.hero_id = unit.id if unit_kind == HERO else None
    claim.group_id = unit.id if unit_kind == HENCHMAN else None
    claim.hireling_id = unit.id if unit_kind == HIRELING else None
    claim.henchman_id = None


def _battle(bounty: Bounty, data: Any, kill: BattleKill | None) -> Battle | None:
    raw = data.get("battle_id") if isinstance(data, dict) else None
    if raw in (None, ""):
        return kill.battle if kill else None
    battle_id = whole(data, "battle_id", low=1, high=2**63 - 1)
    battle = Battle.objects.filter(id=battle_id, campaign_id=bounty.campaign_id).first()
    if battle is None:
        raise field_error("battle_id", "No such battle in this campaign.")
    return battle


def claim_bounty(bounty: Bounty, user: Any, data: Any) -> tuple[BountyClaim, list[BountyWarning]]:
    """A new claim by the player's warband, its part accepted, and its warnings; the bounty is then claimed."""
    _open(bounty)
    warband = _claimant(bounty, user)
    kill = _kill(bounty, warband, data)
    claim = BountyClaim(bounty=bounty, claimant_warband=warband, claimant_user=user, claimant_accepted=True)
    raw_unit = data.get("unit") if isinstance(data, dict) else None
    if raw_unit is None and kill is not None:
        _unit_from_kill(claim, kill)
    else:
        _unit(claim, warband, raw_unit)
    claim.kill, claim.battle = kill, _battle(bounty, data, kill)
    claim.save()
    if bounty.status != CLAIMED:
        bounty.status = CLAIMED
        bounty.save(update_fields=["status", "updated_at"])
    warnings: list[BountyWarning] = []
    if kill is None and not has_record(bounty, warband.id):
        warnings.append(
            {
                "code": "no_record",
                "message": f"Nothing on record shows {warband.name} taking {bounty.target_name} out since the bounty"
                f" was posted. {bounty.posted_by_warband.name} decides.",
            }
        )
    return claim, warnings


def locked_claim(bounty: Bounty, claim_id: int) -> BountyClaim:
    found = (
        BountyClaim.objects.select_for_update(of=("self",))
        .select_related("claimant_warband", "claimant_user", "battle", "kill")
        .filter(bounty=bounty, id=claim_id)
        .first()
    )
    if found is None:
        raise CampaignError("Not found", code="not_found", status=404)
    return found


def side_of(bounty: Bounty, claim: BountyClaim, user: Any) -> str:
    """ "poster" or "claimant": the part the player answers (a 403 for anyone else)."""
    if user.id == bounty.posted_by_user_id:
        return "poster"
    if user.id == claim.claimant_user_id:
        return "claimant"
    raise CampaignError("Only the bounty's poster and the claimant answer a claim.", code="not_a_party", status=403)


def accept_part(bounty: Bounty, claim: BountyClaim, side: str) -> bool:
    """The side accepts its part of a waiting claim: True when both now have (the caller pays it). Accepting a claim
    already paid changes nothing (False)."""
    if claim.status == PAID:
        return False
    if claim.status != PENDING:
        raise CampaignError("This claim has already been answered.", code="claim_closed", status=409)
    _open(bounty)
    setattr(claim, f"{side}_accepted", True)
    claim.save(update_fields=[f"{side}_accepted"])
    return claim.poster_accepted and claim.claimant_accepted


def decline(bounty: Bounty, claim: BountyClaim, side: str) -> None:
    """The poster declines a waiting claim, or the claimant takes his back; the bounty is open again when no other
    claim waits."""
    if claim.status != PENDING:
        raise CampaignError("This claim has already been answered.", code="claim_closed", status=409)
    claim.status = DECLINED if side == "poster" else WITHDRAWN
    claim.answered_at = timezone.now()
    claim.save(update_fields=["status", "answered_at"])
    if bounty.is_live and not BountyClaim.objects.filter(bounty=bounty, status=PENDING).exists():
        bounty.status = OPEN
        bounty.save(update_fields=["status", "updated_at"])
