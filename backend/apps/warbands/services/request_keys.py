"""Request keys: a gold-moving write sent again is answered again, never applied twice (the offline plan's double buy).

On weak signal a purchase, hire or roster Save can go through on the server while its answer never arrives, so the
player taps again. The client sends an `Idempotency-Key` header, one per attempt and the same one on a retry
(`frontend/src/lib/request-key.ts`). The first request with a key writes it beside its answer in the write's own
transaction; a repeat finds it and gets that answer back. Two repeats at once can't both go through: the loser's
insert waits on the unique (warband, key) until the winner commits, fails, and its whole write rolls back. Only an
answer that succeeded is kept (a refusal is not, so a retry is checked afresh), and keys are kept a day.
"""

import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.warbands.models import Warband, WarbandRequestKey
from apps.warbands.models.request_keys import MAX_REQUEST_KEY
from apps.warbands.units.errors import RosterError

HEADER = "Idempotency-Key"
KEPT = timedelta(days=1)
KEY_SHAPE = re.compile(rf"[A-Za-z0-9_-]{{8,{MAX_REQUEST_KEY}}}")
BAD_KEY = f"A request key is 8 to {MAX_REQUEST_KEY} letters, digits, dashes or underscores."
REUSED = "This request key was sent with another kind of write."


@dataclass(frozen=True)
class Answer:
    data: Any
    status: int


def sent_key(headers: Any) -> str | None:
    """The request's key, or None when it sent none (every write still works without one)."""
    raw = headers.get(HEADER)
    if raw is None:
        return None
    key = str(raw).strip()
    if not KEY_SHAPE.fullmatch(key):
        raise RosterError(BAD_KEY, "invalid_request_key", {HEADER: [BAD_KEY]})
    return key


def stored_answer(warband: Warband, key: str, action: str) -> Answer | None:
    row = WarbandRequestKey.objects.filter(warband=warband, key=key).values("action", "answer", "status").first()
    if row is None:
        return None
    if row["action"] != action:
        raise RosterError(REUSED, "request_key_reused", {HEADER: [REUSED]}, status_code=422)
    return Answer(row["answer"], row["status"])


def once(warband: Warband, key: str, action: str, write: Callable[[], Answer]) -> tuple[Answer, bool]:
    """`write`'s answer, and whether it was answered before (True: nothing was written this time)."""
    stored = stored_answer(warband, key, action)
    if stored is not None:
        return stored, True
    try:
        with transaction.atomic():
            answer = write()
            WarbandRequestKey.objects.filter(warband=warband, created_at__lt=timezone.now() - KEPT).delete()
            WarbandRequestKey.objects.create(
                warband=warband, key=key, action=action, status=answer.status, answer=answer.data
            )
    except IntegrityError:
        stored = stored_answer(warband, key, action)  # a repeat that ran beside it won; this one rolled back
        if stored is None:
            raise
        return stored, True
    return answer, False
