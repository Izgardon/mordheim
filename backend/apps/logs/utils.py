from typing import Any, Dict, Optional

from apps.warbands.models import WarbandLog


def log_warband_event(
    warband_id: int,
    feature: str,
    entry_type: str,
    payload: Optional[Dict[str, Any]] = None,
    parent_id: Optional[int] = None,
):
    if not warband_id or not feature or not entry_type:
        return None

    return WarbandLog.objects.create(
        warband_id=warband_id,
        feature=feature,
        entry_type=entry_type,
        payload=payload or {},
        parent_id=parent_id,
    )
