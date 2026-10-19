"""Declarative refusals for battle endpoints (`BattleScopedView.rules`), checked in order once the battle and the
caller's participant are loaded (and locked, for a write). Each rule answers a Response to stop there (a refusal,
or the snapshot for a repeat that has nothing left to do) or None to go on."""

from collections.abc import Callable, Collection
from typing import TYPE_CHECKING

from rest_framework.response import Response

from ..models import Battle
from ..services.errors import battle_status_changed
from .responses import response_with_snapshot

if TYPE_CHECKING:
    from .base import Scope

Rule = Callable[["Scope"], Response | None]


def refused(detail: str, *, code: str | None = None, status: int = 400) -> Response:
    body = {"detail": detail}
    if code:
        body["code"] = code
    return Response(body, status=status)


def _wrong_status(scope: "Scope", detail: str, code: str | None) -> Response:
    """A refusal for the battle's status: its own code when it has one, else battle_status_changed and the current
    status (the page reads the state again, BUG-19)."""
    return refused(detail, code=code) if code else battle_status_changed(scope.battle, detail).response()


def refuse(statuses: Collection[str], detail: str, *, code: str | None = None) -> Rule:
    """Refuse while the battle is in one of `statuses`."""
    return lambda scope: _wrong_status(scope, detail, code) if scope.battle.status in statuses else None


def only(statuses: Collection[str], detail: str, *, code: str | None = None) -> Rule:
    """Refuse unless the battle is in one of `statuses`."""
    return lambda scope: None if scope.battle.status in statuses else _wrong_status(scope, detail, code)


def snapshot_when(*statuses: str) -> Rule:
    """A repeat while the battle is in one of `statuses` answers the snapshot and changes nothing."""
    return lambda scope: response_with_snapshot(scope.battle.id, []) if scope.battle.status in statuses else None


def refuse_player(statuses: Collection[str], detail: str, *, code: str | None = None) -> Rule:
    """Refuse while the caller's participant is in one of `statuses`."""
    return lambda scope: refused(detail, code=code) if scope.player.status in statuses else None


def only_player(statuses: Collection[str], detail: str) -> Rule:
    """Refuse unless the caller's participant is in one of `statuses`."""
    return lambda scope: None if scope.player.status in statuses else refused(detail)


def snapshot_when_player(*statuses: str) -> Rule:
    """A repeat once the caller's participant is in one of `statuses` answers the snapshot."""
    return lambda scope: response_with_snapshot(scope.battle.id, []) if scope.player.status in statuses else None


def creator_only(detail: str, *, code: str | None = None) -> Rule:
    """Only the battle's creator (403)."""
    return lambda scope: None if scope.is_creator else refused(detail, code=code, status=403)


def normal_flow(detail: str) -> Rule:
    """Not for reported results."""
    return lambda scope: refused(detail) if scope.battle.flow_type != Battle.FLOW_TYPE_NORMAL else None


def reported_flow(detail: str) -> Rule:
    """Only for reported results."""
    return lambda scope: refused(detail) if scope.battle.flow_type != Battle.FLOW_TYPE_REPORTED_RESULT else None
