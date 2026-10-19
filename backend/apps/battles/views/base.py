"""BattleScopedView: every battle endpoint's load, lock and refusal preamble, written once (IMP-53).

A view names its `rules` (allowed statuses, creator-only, flow) and implements the action; the base loads the
battle with the caller's membership in one query (404 for a non-member, or a member who isn't in the battle),
locks the battle and then the caller's participant for a write (`FOR UPDATE OF`, PERF-37), settles an overdue
battle first (decision 2), checks the rules in order and answers:

- `Written`: the action changed what others see: the battle's state_version goes up and its events are broadcast
  after the transaction (services/broadcast.py);
- `Unchanged`: nothing others see changed (a repeat, notes, a draft): the snapshot, no broadcast;
- a Response, or a `Refused` / `BattleError` raised before the action wrote anything (answered inside the
  transaction, so what settling an overdue battle wrote is kept).
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from django.db import transaction
from rest_framework import permissions
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.throttling import BATTLE_WRITE_THROTTLE_CLASSES

from ..models import Battle, BattleParticipant
from ..services.access import is_member, manages_battles, participant_rows, scoped_battles
from ..services.broadcast import Changed, bump_state_version
from ..services.errors import BattleError, Refused
from ..services.expiry import settle_during_write
from ..services.locks import locked
from ..services.timing import is_overdue, record_activity
from ..services.warnings import Warning
from .responses import broadcast_response, response_with_snapshot
from .rules import Rule

READ, LOCK_BATTLE, LOCK_PLAYER = "", "battle", "player"


def not_found() -> Refused:
    return Refused("Not found", status=404)


@dataclass
class Scope:
    """The battle a request acts on, the caller's participant in it (None for a manager view) and the request."""

    request: Request
    battle: Battle
    participant: BattleParticipant | None

    @property
    def user(self):
        return self.request.user

    @property
    def player(self) -> BattleParticipant:
        assert self.participant is not None, "a view with in_battle=False has no participant"
        return self.participant

    @property
    def is_creator(self) -> bool:
        return bool(self.battle.created_by_user_id == self.request.user.id)

    @property
    def manages_battles(self) -> bool:
        return manages_battles(self.battle)


@dataclass
class Written:
    """A write others see: its events, the participants it changed (or ALL), and how it answers."""

    events: list[dict]
    changed: Changed = ()
    reason: str = ""
    status: int = 200
    warnings: list[Warning] | None = None
    body: dict | None = None  # more for the acting player's answer only


@dataclass
class Unchanged:
    """Nothing others see changed: the snapshot answers; `activity` still moves last_activity_at (a private
    write: notes, a draft)."""

    events: list[dict] = field(default_factory=list)
    status: int = 200
    warnings: list[Warning] | None = None
    activity: bool = False
    body: dict | None = None


Outcome = Written | Unchanged | Response


class BattleScopedView(APIView):
    """Reads and writes on one battle of a campaign (URL kwargs `campaign_id`, `battle_id`)."""

    permission_classes = [permissions.IsAuthenticated]
    rules: tuple[Rule, ...] = ()
    in_battle = True  # the caller must be one of the battle's participants
    battle_related: tuple[str, ...] = ()  # read with an unlocked battle (finalise: the campaign's settings)

    def load_scope(self, request: Request, campaign_id: int, battle_id: int, *, lock: str = READ) -> Scope:
        """The battle and the caller's participant: `READ` locks nothing; `LOCK_BATTLE` (a write) locks the battle,
        then the participant; `LOCK_PLAYER` (finalise, PERF-36) locks only the participant. A write to an overdue
        battle settles it first, under the battle lock (decision 2)."""
        battles = scoped_battles(request.user, campaign_id).filter(id=battle_id)
        if lock == LOCK_BATTLE:
            battles = locked(battles)
        elif self.battle_related:
            battles = battles.select_related(*self.battle_related)
        battle = battles.first()
        if battle is None or not is_member(battle):
            raise not_found()
        if not self.in_battle:
            if lock == LOCK_BATTLE and is_overdue(battle):
                settle_during_write(battle)
            return Scope(request, battle, None)
        rows = participant_rows(battle, request.user)
        if lock:
            rows = locked(rows)  # not the user or warband rows it joins (PERF-37)
            if is_overdue(battle):
                if lock == LOCK_PLAYER:  # the battle first, as every write locks it
                    battle = locked(scoped_battles(request.user, campaign_id)).get(id=battle_id)
                settle_during_write(battle)
        participant = rows.first()
        if participant is None:
            raise not_found()
        return Scope(request, battle, participant)

    def refusal(self, scope: Scope) -> Response | None:
        for rule in self.rules:
            if (answer := rule(scope)) is not None:
                return answer
        return None

    def read(self, request: Request, campaign_id: int, battle_id: int) -> Scope | Response:
        try:
            return self.load_scope(request, campaign_id, battle_id)
        except Refused as refused:
            return refused.response()


class BattleWriteView(BattleScopedView):
    """A battle write (POST): `parse` checks the input first, then `act` runs on the locked battle once the rules
    pass, in one transaction, and the base answers."""

    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES
    input: Any = None

    def parse(self, request: Request) -> Any:
        """The request's input, checked before the battle is loaded (a Response refuses it)."""
        return None

    def act(self, scope: Scope) -> Outcome:
        raise NotImplementedError

    def post(self, request: Request, campaign_id: int, battle_id: int, **kwargs: Any) -> Response:
        parsed = self.parse(request)
        if isinstance(parsed, Response):
            return parsed
        self.input = parsed
        return self.write(request, campaign_id, battle_id, self.act)

    def write(self, request: Request, campaign_id: int, battle_id: int, act: Callable[[Scope], Outcome]) -> Response:
        with transaction.atomic():
            try:
                scope = self.load_scope(request, campaign_id, battle_id, lock=LOCK_BATTLE)
                refusal = self.refusal(scope)
                outcome = refusal if refusal is not None else act(scope)
            except (Refused, BattleError) as refused:
                return refused.response()
            if isinstance(outcome, Response):
                return outcome
            if isinstance(outcome, Unchanged):
                if outcome.activity:
                    record_activity(scope.battle)
                return response_with_snapshot(
                    scope.battle.id, outcome.events, outcome.status, outcome.warnings, outcome.body
                )
            version = bump_state_version(scope.battle)
        return broadcast_response(
            request,
            scope.battle.id,
            outcome.events,
            version,
            changed=outcome.changed,
            reason=outcome.reason,
            response_status=outcome.status,
            warnings=outcome.warnings,
            body=outcome.body,
        )
