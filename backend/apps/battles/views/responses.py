"""How a battle write answers: the fresh snapshot, the events it added and its warnings (PERF-34).

A write that raised the battle's state_version also sends its events, or a battle_state_updated, to the other
players (services/broadcast.py); one that changed nothing others see answers without broadcasting.
"""

from rest_framework.response import Response

from apps.realtime.services import sender_socket_id

from ..serializers import battle_snapshot
from ..services.broadcast import Changed, publish
from ..services.capabilities import capabilities_from, snapshot_facts


def answer(payload: dict, events: list[dict], response_status: int = 200, warnings=None, body=None) -> Response:
    """The acting player's answer: the snapshot, the events, his warnings and what else the write tells only him
    (`body`, e.g. the results to confirm)."""
    payload = {**payload, **(body or {}), "events": events}
    if warnings:
        payload["warnings"] = warnings
    return Response(payload, status=response_status)


def with_capabilities(response: Response, user_id: int | None, manager: bool) -> Response:
    """A write's answer carries the caller's capabilities, worked out from the snapshot it answers, so the page
    needs no read to know what it may do next."""
    data = response.data
    if response.status_code < 300 and isinstance(data, dict) and data.get("battle") and "participants" in data:
        data["capabilities"] = capabilities_from(snapshot_facts(data), user_id, manager)
    return response


def response_with_snapshot(
    battle_id: int, events: list[dict], response_status=200, warnings=None, body=None
) -> Response:
    """Answer with the fresh snapshot, broadcasting nothing (a write that changed nothing others see)."""
    return answer(battle_snapshot(battle_id), events, response_status, warnings, body)


def publish_snapshot(
    request, payload: dict, events: list[dict], version: int, changed: Changed, reason: str, postbattle=None
) -> None:
    """Queue the write's messages for the other players (sent after commit, skipping the sender's socket)."""
    publish(
        payload,
        events,
        version=version,
        changed=changed,
        reason=reason,
        actor_user_id=request.user.id,
        socket_id=sender_socket_id(request),
        postbattle=postbattle,
    )


def broadcast_response(
    request,
    battle_id: int,
    events: list[dict],
    version: int,
    *,
    changed: Changed = (),
    reason: str = "",
    response_status=200,
    warnings=None,
    body=None,
    postbattle=None,
) -> Response:
    """Answer a write that raised the battle's state_version (`version`) with the fresh snapshot, and send its
    events, or a battle_state_updated, to the other players with the snapshots of the participants it `changed`
    (and the `postbattle` guides, services/broadcast.py). Called after the write's transaction; the sends go out
    in the background."""
    payload = battle_snapshot(battle_id)
    publish_snapshot(request, payload, events, version, changed, reason, postbattle)
    return answer(payload, events, response_status, warnings, body)
