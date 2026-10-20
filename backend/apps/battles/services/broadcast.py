"""What the other players' clients receive after a battle write (PERF-34, BUG-75).

Each write that changes shared state raises `Battle.state_version` by one, inside its transaction and under the
battle lock, so versions follow the order writes commit in. After the transaction the write answers its own client
with the fresh snapshot and sends the same change to the battle channel, skipping the sender's own socket when the
request names it (`X-Pusher-Socket-Id`):

- one `battle.event` message per event the write added, in order, each with the write's `state_version`;
- or, for a write that adds no event, one `battle_state_updated` message;
- the last message also carries `battle` (the serialised battle), `capabilities` (each player's flags and a
  battle manager's, services/capabilities.py `everyones_capabilities`, so a phase change costs no read) and
  `participants`, the snapshots of the participants the write changed (all of them for a phase change), unless
  they would push the message past Pusher's 10 KB limit: then `participants` is empty and `snapshot_omitted` is
  true, and clients read `state/`;
- a write that puts players into postbattle or changes its winners (the end of the fight, the results) adds
  `postbattle: {"rules", "suggested": {user id: suggested_postbattle}}` for every player in his own postbattle, so
  their pages need no extra read (item 8). Under the limit first goes the snapshot, then the suggestions, then the
  rules: what doesn't fit is left out and flagged (`rules_omitted` inside `postbattle`, or `postbattle_omitted`),
  and those clients read `state/?view=postbattle`.

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
from .capabilities import everyones_capabilities

SNAPSHOT_LIMIT_BYTES = 9000  # Pusher refuses messages over 10 KB; the rest is the event and envelope
ALL = "all"  # every participant changed (a phase change)

Changed = Collection[int] | str


def bump_state_version(battle: Battle) -> int:
    """Raise the battle's state_version for this write (call inside its transaction, with the battle locked),
    record the activity (BUG-10) and return the new version; the write broadcasts it after commit."""
    battle.state_version = (battle.state_version or 0) + 1
    battle.updated_at = battle.last_activity_at = timezone.now()
    Battle.objects.filter(id=battle.id).update(
        state_version=battle.state_version, updated_at=battle.updated_at, last_activity_at=battle.last_activity_at
    )
    return battle.state_version


def _fits(fields: dict[str, Any]) -> bool:
    return len(json.dumps(fields, default=str)) <= SNAPSHOT_LIMIT_BYTES


def _with_postbattle(fields: dict[str, Any], postbattle: dict[str, Any] | None) -> dict[str, Any]:
    """The snapshot fields plus as much of the postbattle guides as fits: all, without the rules, or none."""
    if not postbattle:
        return fields
    for attempt in (postbattle, {"suggested": postbattle.get("suggested", {}), "rules_omitted": True}):
        if _fits(with_guides := {**fields, "postbattle": attempt}):
            return with_guides
    return {**fields, "postbattle_omitted": True}


def _snapshot_fields(snapshot: dict[str, Any], changed: Changed, postbattle: dict[str, Any] | None) -> dict[str, Any]:
    participants = snapshot["participants"]
    if changed != ALL:
        participants = [entry for entry in participants if entry["id"] in changed]
    always = {"battle": snapshot["battle"], "capabilities": everyones_capabilities(snapshot)}
    fields = {**always, "participants": participants}
    if not _fits(fields):
        omitted = {**always, "participants": [], "snapshot_omitted": True}
        return {**omitted, "postbattle_omitted": True} if postbattle else omitted
    return _with_postbattle(fields, postbattle)


def publish(
    snapshot: dict[str, Any],
    events: list[dict[str, Any]],
    *,
    version: int,
    changed: Changed,
    reason: str,
    actor_user_id: int | None,
    socket_id: str | None,
    postbattle: dict[str, Any] | None = None,
) -> None:
    """Queue the write's messages for the battle channel (sent after commit, in the background)."""
    battle = snapshot["battle"]
    last = {"state_version": version, **_snapshot_fields(snapshot, changed, postbattle)}
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
