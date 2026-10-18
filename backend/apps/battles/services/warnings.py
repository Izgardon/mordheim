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
