"""Changing the starting gold once warbands exist (BUG-78, decision 6, CAMP-TWEAK-05).

The PATCH must say whether existing warbands follow (`adjust_existing_warbands`): the dialog asks each time. When
they do, each gets one ledger Adjustment of new minus old ("Starting gold changed from 500 to 600 gc"), whatever its
own first row says, all in one INSERT and one balance UPDATE. No row is ever rewritten. New warbands start with the
new amount either way (warbands/views/warbands.py).
"""

from typing import Any

from apps.warbands.models import LedgerAction, Warband
from apps.warbands.services import ledger

from ..errors import CampaignError
from ..models import Campaign

ADJUST_FLAG = "adjust_existing_warbands"
ADJUST_REQUIRED = "Say whether existing warbands get the difference in starting gold."


def changed_from(campaign: Campaign, validated: dict[str, Any]) -> int | None:
    """The current starting gold when the PATCH changes it, else None. CampaignError (400) when the campaign has
    warbands and the PATCH doesn't say whether to adjust them."""
    if "starting_gold" not in validated:
        return None
    settings = getattr(campaign, "settings", None)
    old = settings.starting_gold if settings else 500
    if validated["starting_gold"] == old:
        return None
    if ADJUST_FLAG not in validated and Warband.objects.filter(campaign=campaign).exists():
        raise CampaignError(
            ADJUST_REQUIRED, code="adjust_existing_warbands_required", fields={ADJUST_FLAG: [ADJUST_REQUIRED]}
        )
    return old


def adjust_warbands(campaign: Campaign, old: int, new: int) -> int:
    """One Adjustment of `new - old` per warband of the campaign; returns how many were adjusted."""
    warbands = list(Warband.objects.filter(campaign=campaign).only("id", "gold").order_by("id"))
    description = f"Starting gold changed from {old} to {new} gc"
    ledger.record_entries(
        [ledger.Entry(warband, LedgerAction.ADJUSTMENT, new - old, description) for warband in warbands]
    )
    return len(warbands)
