"""What the other players' clients receive after a battle write (PERF-34, BUG-75).

Each write that changes shared state raises `Battle.state_version` by one, inside its transaction and under the
battle lock, so versions follow the order writes commit in. After the transaction the write answers its own client
with the fresh snapshot and sends the same change to the battle channel, skipping the sender's own socket when the
request names it (`X-Pusher-Socket-Id`):

- one `battle.event` message per event the write added, in order, each with the write's `state_version`;
- or, for a write that adds no event, one `battle_state_updated` message;
- the last message also carries `battle` (the serialised battle) and `participants`, the snapshots of the
  participants the write changed (all of them for a phase change), unless they would push the message past
  Pusher's 10 KB limit: then `participants` is empty and `snapshot_omitted` is true, and clients read `state/`.

A client patches its copy from the message when `state_version` is its own plus one (or, for the later messages
of the same write, equal to it) and reads `state/` on a gap. Writes that change only what the player alone sees
(notes, the postbattle draft) neither raise the version nor broadcast.
"""

import json
from collections.abc import Collection
from typing import Any

from django.utils import timezone

from apps.realtime.services import send_battle_event

from ..models import Battle

SNAPSHOT_LIMIT_BYTES = 9000  # Pusher refuses messages over 10 KB; the rest is the event and envelope
ALL = "all"  # every participant changed (a phase change)

Changed = Collection[int] | str


def bump_state_version(battle: Battle) -> int:
    """Raise the battle's state_version for this write (call inside its transaction, with the battle locked) and
    return the new version; the write broadcasts it after commit."""
    battle.state_version = (battle.state_version or 0) + 1
    battle.updated_at = timezone.now()
    Battle.objects.filter(id=battle.id).update(state_version=battle.state_version, updated_at=battle.updated_at)
    return battle.state_version


def _snapshot_fields(snapshot: dict[str, Any], changed: Changed) -> dict[str, Any]:
    participants = snapshot["participants"]
    if changed != ALL:
        participants = [entry for entry in participants if entry["id"] in changed]
    fields = {"battle": snapshot["battle"], "participants": participants}
    if len(json.dumps(fields, default=str)) > SNAPSHOT_LIMIT_BYTES:
        return {"battle": snapshot["battle"], "participants": [], "snapshot_omitted": True}
    return fields


def publish(
    snapshot: dict[str, Any],
    events: list[dict[str, Any]],
    *,
    version: int,
    changed: Changed,
    reason: str,
    actor_user_id: int | None,
    socket_id: str | None,
) -> None:
    """Queue the write's messages for the battle channel (sent after commit, in the background)."""
    battle = snapshot["battle"]
    last = {"state_version": version, **_snapshot_fields(snapshot, changed)}
    if events:
        for event in events[:-1]:
            send_battle_event(battle["id"], event["type"], event, socket_id=socket_id, state_version=version)
        send_battle_event(battle["id"], events[-1]["type"], events[-1], socket_id=socket_id, **last)
        return
    payload = {
        "battle_id": battle["id"],
        "campaign_id": battle["campaign_id"],
        "status": battle["status"],
        "actor_user_id": actor_user_id,
        "reason": reason,
        "state_version": version,
    }
    send_battle_event(battle["id"], "battle_state_updated", payload, socket_id=socket_id, **last)
