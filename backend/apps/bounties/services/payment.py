"""Paying a bounty once both sides have accepted a claim: the gold moves, as ledger rows on both warbands.

Runs in the accept's transaction under the bounty's and the claim's row locks; both warbands are locked lowest id
first, as trade completion locks them. The poster may not hold the gold any more: the warning says so and he pays
anyway, going below 0 (a guide, not a gatekeeper). The other claims still waiting close. A claim tied to a battle
leaves a moment in that battle's row ("Bounty claimed"), which regenerating the battle's moments keeps.
"""

from django.utils import timezone

from apps.campaigns.models import PivotalMoment
from apps.campaigns.pivotal_moments import BOUNTY_CLAIMED
from apps.warbands.models import LedgerAction, Warband
from apps.warbands.services import ledger

from ..models import HENCHMAN, HERO, HIRELING, PAID, Bounty, BountyClaim
from .posting import BountyWarning, close_waiting_claims


def _moment(bounty: Bounty, claim: BountyClaim, poster: Warband) -> PivotalMoment | None:
    battle = claim.battle
    if battle is None:
        return None
    kill = claim.kill
    return PivotalMoment.objects.create(
        campaign_id=bounty.campaign_id,
        battle=battle,
        warband_id=claim.claimant_warband_id,
        source_kill=kill,
        round=kill.round if kill else None,
        kind=BOUNTY_CLAIMED,
        headline="Bounty claimed",
        detail=f"{claim.unit_name} collected the {bounty.amount} gc bounty {poster.name} put on {bounty.target_name}.",
        unit_kind=claim.unit_kind,
        hero_id=claim.hero_id if claim.unit_kind == HERO else None,
        henchman_id=claim.henchman_id if claim.unit_kind == HENCHMAN else None,
        group_id=claim.group_id if claim.unit_kind == HENCHMAN else None,
        hireling_id=claim.hireling_id if claim.unit_kind == HIRELING else None,
        unit_name=claim.unit_name,
        battle_ended_at=battle.ended_at or timezone.now(),
    )


def pay(bounty: Bounty, claim: BountyClaim) -> tuple[list[BountyWarning], list[BountyClaim]]:
    """Move the bounty's gold to the claimant and mark both paid: the warnings, and the other claims it closed."""
    ids = sorted({bounty.posted_by_warband_id, claim.claimant_warband_id})
    warbands = {
        warband.id: warband for warband in Warband.objects.select_for_update().filter(id__in=ids).order_by("id")
    }
    poster, claimant = warbands[bounty.posted_by_warband_id], warbands[claim.claimant_warband_id]
    warnings: list[BountyWarning] = []
    if poster.gold < bounty.amount:
        warnings.append(
            {
                "code": "gold_short",
                "message": f"{poster.name} held {poster.gold} gc and paid the {bounty.amount} gc bounty anyway: its"
                f" gold is now {poster.gold - bounty.amount} gc.",
            }
        )
    how = f"{claim.unit_name} took {bounty.target_name} out" + (f" ({claim.battle.scenario})" if claim.battle else "")
    ledger.record_entries(
        [
            ledger.Entry(
                poster,
                LedgerAction.BOUNTY,
                -bounty.amount,
                f"Bounty on {bounty.target_name} paid to {claimant.name}",
                how,
            ),
            ledger.Entry(
                claimant, LedgerAction.BOUNTY, bounty.amount, f"Bounty on {bounty.target_name} from {poster.name}", how
            ),
        ]
    )
    now = timezone.now()
    claim.status, claim.answered_at = PAID, now
    claim.save(update_fields=["status", "answered_at"])
    closed = close_waiting_claims(bounty, keep=claim)
    bounty.status, bounty.closed_at, bounty.paid_claim = PAID, now, claim
    bounty.save(update_fields=["status", "closed_at", "paid_claim", "updated_at"])
    _moment(bounty, claim, poster)
    return warnings, closed
