"""The units a participant brought to the battle: the keys he selected, and his custom and bestiary units."""

from ..models import BattleParticipant
from ..validation.unit_keys import is_temporary


def custom_unit_keys(participant: BattleParticipant) -> set[str]:
    custom_units = participant.custom_units_json or []
    keys: set[str] = set()
    if not isinstance(custom_units, list):
        return keys
    for entry in custom_units:
        if not isinstance(entry, dict):
            continue
        key = entry.get("key")
        if isinstance(key, str) and key.strip():
            keys.add(key.strip())
    return keys


def selected_unit_keys(participant: BattleParticipant) -> set[str]:
    """The selected keys, leaving out a custom or bestiary key with no unit behind it."""
    selected = participant.selected_unit_keys_json or []
    if not isinstance(selected, list):
        return set()
    selected_keys = set()
    custom_keys = custom_unit_keys(participant)
    for raw_key in selected:
        if not isinstance(raw_key, str):
            continue
        key = raw_key.strip()
        if not key or (is_temporary(key) and key not in custom_keys):
            continue
        selected_keys.add(key)
    return selected_keys


def permanent_unit_keys(participant: BattleParticipant) -> set[str]:
    """The selected units of the participant's warband (postbattle needs a result for each)."""
    return {key for key in selected_unit_keys(participant) if not is_temporary(key)}


def custom_unit_entry(participant: BattleParticipant, unit_key: str) -> dict | None:
    custom_units = participant.custom_units_json if isinstance(participant.custom_units_json, list) else []
    for entry in custom_units:
        if isinstance(entry, dict) and str(entry.get("key", "")).strip() == unit_key:
            return entry
    return None
