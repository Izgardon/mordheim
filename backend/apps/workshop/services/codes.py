"""Minting the codes a workshop's warbands and lists are shared by (`apps/core/share_codes.py`): unique across both,
deleted and archived ones included, so a code once given out never points at something else."""

from apps.core.share_codes import new_share_code
from apps.warband_templates.models import WarbandTemplate
from apps.warbands.models import Warband


def unique_share_code() -> str:
    """A code no warband or list uses (two queries a try; each column's unique index has the last word)."""
    for _ in range(20):
        code = new_share_code()
        if not Warband.objects.filter(share_code=code).exists() and not (
            WarbandTemplate.objects.filter(share_code=code).exists()
        ):
            return code
    return new_share_code()
