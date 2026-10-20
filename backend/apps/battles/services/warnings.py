"""Warnings a battle write answers with instead of refusing (a guide, not a gatekeeper).

Each is `{"code": str, "message": str, ...}`, the shape purchases and trades answer: returned in the acting
player's answer under `warnings` (only when there are any), never broadcast.
"""

from typing import Any

Warning = dict[str, Any]

UNIT_LEFT_WARBAND = "unit_left_warband"


def unit_left_warband(unit_key: str, unit_name: str) -> Warning:
    """Finalise left out a unit dismissed since the battle started (BUG-73)."""
    return {
        "code": UNIT_LEFT_WARBAND,
        "message": f"{unit_name} has left the warband, so his results were not applied.",
        "unit_key": unit_key,
    }


CAMPAIGN_NOT_STARTED = "campaign_not_started"


def campaign_not_started() -> Warning:
    """A battle or reported result before the campaign's start: allowed, with a warning (decision 3, BUG-77)."""
    return {"code": CAMPAIGN_NOT_STARTED, "message": "The campaign hasn't started yet."}


def campaign_warnings(started: bool) -> list[Warning]:
    """What a new battle or reported result warns about its campaign."""
    return [] if started else [campaign_not_started()]
