"""A rider getting off his mount for the rest of the battle, or back on it (the bestiary rewrite step 5).

`dismounted: true` in the rider's unit information (left out when false) puts his foot Move and save back in the
battle's display and helpers, and a rider who is dismounted when he is taken out of action doesn't put his mount at
risk after the battle (services/postbattle/mounts.py). Like `out_of_action` and `kill_count`, it changes only through
its own endpoint, so a config save never undoes it; it can't change while the rider is out of action, so the state he
was taken out in is the one postbattle reads.
"""

from ..models import BattleParticipant
from ..validation.config import normalize_unit_information
from .errors import Refused
from .roster_units import roster_entry
from .selection import selected_unit_keys
from .unit_information import is_empty, unit_entry

NOT_MOUNTED = "Only a unit riding a mount in this battle can dismount."
OUT_OF_ACTION = "A unit out of action can't dismount or mount again; set it back in action first."


def set_dismounted(participant: BattleParticipant, unit: dict, dismounted: bool) -> bool:
    """Mark one of the participant's selected riders dismounted (or back on his mount); whether anything changed."""
    unit_key = unit["unit_key"]
    if unit_key not in selected_unit_keys(participant):
        raise Refused("unit_key is not selected for this participant")
    entry = roster_entry(participant.roster_json, unit_key)
    if not entry or not entry.get("mount"):
        raise Refused(NOT_MOUNTED, code="not_mounted")
    unit_information = normalize_unit_information(participant.unit_information_json)
    info = unit_entry(unit_information, unit_key)
    if info["out_of_action"]:
        raise Refused(OUT_OF_ACTION, code="out_of_action")
    if bool(info.get("dismounted")) == dismounted:
        return False
    if dismounted:
        info["dismounted"] = True
    else:
        info.pop("dismounted", None)
    if is_empty(info):
        unit_information.pop(unit_key, None)
    participant.unit_information_json = unit_information
    participant.save(update_fields=["unit_information_json", "updated_at"])
    return True
