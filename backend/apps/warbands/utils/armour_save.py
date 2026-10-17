"""Armour saves as the app stores them: a whole number N meaning "N+", or None for no save (decision 11, BUG-87).

Players type them as on the roster sheet ("5+") or as a number (5, "5"). Strength modifiers can push a
save past 1+ on paper, so 0+ and below are allowed down to -5+ (a roll of 1 still always fails; the client
says so). 6+ is the worst save; no save at all is empty.
"""

import re
from decimal import Decimal
from typing import Any

BEST_ARMOUR_SAVE = -5
WORST_ARMOUR_SAVE = 6
ARMOUR_SAVE_ERROR = (
    f'Enter a save from {BEST_ARMOUR_SAVE}+ to {WORST_ARMOUR_SAVE}+, such as "4+" or 4, or leave it empty.'
)
_SAVE_TEXT = re.compile(r"^(-?\d+)\s*\+?$")


def parse_armour_save(value: Any) -> int | None:
    """The save N for "N+", or None for no save; ValueError (ARMOUR_SAVE_ERROR) for anything else."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    if isinstance(value, bool):
        raise ValueError(ARMOUR_SAVE_ERROR)
    if isinstance(value, int):
        save = value
    elif isinstance(value, float | Decimal):
        if not Decimal(str(value)).is_finite() or value != int(value):
            raise ValueError(ARMOUR_SAVE_ERROR)
        save = int(value)
    elif isinstance(value, str) and (match := _SAVE_TEXT.match(value.strip())):
        save = int(match.group(1))
    else:
        raise ValueError(ARMOUR_SAVE_ERROR)
    if not BEST_ARMOUR_SAVE <= save <= WORST_ARMOUR_SAVE:
        raise ValueError(ARMOUR_SAVE_ERROR)
    return save
