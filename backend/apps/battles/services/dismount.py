"""A rider getting off his mount for the rest of the battle, or back on it (the bestiary rewrite step 5).

`dismounted: true` in the rider's unit information (left out when false) drops the mount's Move and the step riding
it is worth from what the battle shows him at (`footStats` beside `effectiveStats` on his roster entry, William,
18 Nov 2026: "this should take 1 away and add one when mounted"), and a rider who is dismounted when he is taken out
of action doesn't put his mount at risk after the battle (services/postbattle/mounts.py). Like `out_of_action`, it
changes only through its own endpoint, so a config save never undoes it; it can't change while the rider is out of
action, so the state he was taken out in is the one postbattle reads.

Nothing of this is written to the unit: the stored save already has the mount's step, because he rides it on the
roster (warbands/services/armour.py), and getting off is a state of this one battle, so it goes with the battle's
other per-unit adjustments and is gone when the battle ends.
"""

from typing import Any

from apps.items.models import SAVE_MOUNT
from apps.warbands.services.armour import Save
from apps.warbands.utils.armour_save import move_armour_save

from ..models import BattleParticipant
from ..validation.config import normalize_unit_information
from .errors import Refused
from .roster_units import roster_entry
from .selection import selected_unit_keys
from .unit_information import is_empty, unit_entry

NOT_MOUNTED = "Only a unit riding a mount in this battle can dismount."
OUT_OF_ACTION = "A unit out of action can't dismount or mount again; set it back in action first."


def mount_steps(item: Any) -> int:
    """What riding the mount `item` is worth to its rider's save, as switching it on paid it (services/armour.py)."""
    save = Save.of(item)
    return (save.bonus or 0) if save.moves and save.slot == SAVE_MOUNT else 0


def foot_stats(unit: Any, mount: Any | None) -> dict[str, Any] | None:
    """What a rider shows once he is off his mount (None for a unit with none): his save less the step riding it is
    worth, which the stored one holds. His Move isn't here; dropping `effectiveStats` leaves his own showing."""
    if mount is None:
        return None
    return {"armour_save": move_armour_save(unit.armour_save, -mount_steps(mount.item))}


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
