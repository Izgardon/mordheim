"""The codes a custom warband or warband list is shared by (the workshop plan, docs/plans/workshop.md): eight capitals
and digits without the lookalikes 0, O, 1, I and L, read case-blind with spaces and dashes ignored. A code is unique
across warbands and lists alike (apps/workshop/services/codes.py makes one); null on anything not shared."""

import secrets
from typing import Any

SHARE_CODE_LENGTH = 8
SHARE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no 0/O, 1/I/L


def new_share_code() -> str:
    return "".join(secrets.choice(SHARE_CODE_ALPHABET) for _ in range(SHARE_CODE_LENGTH))


def normalised(code: Any) -> str:
    """A code as it was typed or pasted, as it is stored: capitals, no spaces or dashes."""
    return str(code or "").strip().upper().replace(" ", "").replace("-", "")
