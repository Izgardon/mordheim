"""A player's postbattle: saving the draft, applying the aftermath step he leaves, Ready, or skipping the aftermath.
It starts when he finishes his battle, so the others may still be fighting (decision 4)."""

from django.db import transaction
from rest_framework.response import Response

from apps.realtime.services import send_warband_changed, sender_socket_id

from ..models import Battle, BattleParticipant
from ..serializers import battle_snapshot, snapshot
from ..services.broadcast import ALL
from ..services.closing import skip
from ..services.errors import Refused
from ..services.postbattle.finalise import (
    apply_aftermath_step,
    apply_player_postbattle,
    confirm_postbattle,
    save_draft,
)
from ..services.postbattle.steps import STEPS, AftermathLocked
from .base import LOCK_PLAYER, BattleWriteView, Scope, Unchanged, Written
from .responses import answer, publish_snapshot
from .rules import only, only_player, refuse, refused, snapshot_when_player

CONFIRMED = BattleParticipant.STATUS_CONFIRMED_POSTBATTLE
FINISHED = BattleParticipant.STATUS_FINISHED_BATTLE
NOT_IN_POSTBATTLE = "Battle is not in postbattle"
POSTBATTLE_OPEN = (Battle.STATUS_ACTIVE, Battle.STATUS_POSTBATTLE)  # his own postbattle, once he has finished


def _changed(scope: Scope):
    return ALL if scope.battle.status == Battle.STATUS_ENDED else [scope.player.id]


def _bad_draft(exc: ValueError) -> Response:
    """A draft that can't be applied: the reason, and for a change to what has left the aftermath its code and where
    to make the change instead (services/postbattle/steps.py)."""
    body = {"detail": str(exc)}
    if isinstance(exc, AftermathLocked):
        body["code"] = exc.code
    return Response(body, status=400)


def _skipped(scope: Scope) -> Response | None:
    if scope.player.status == CONFIRMED and scope.player.skipped_postbattle:
        detail = "Your postbattle was skipped, so its results can't be applied now"
        return refused(detail, code="postbattle_skipped")
    return None


class CampaignBattlePostbattleSaveView(BattleWriteView):
    rules = (
        only(POSTBATTLE_OPEN, NOT_IN_POSTBATTLE),
        snapshot_when_player(CONFIRMED),
        only_player((FINISHED,), "You must enter postbattle before saving it"),
    )

    def act(self, scope: Scope):
        raw_draft = scope.request.data.get("postbattle_json", scope.player.postbattle_json)
        try:
            warnings = save_draft(scope.battle, scope.player, raw_draft)
        except ValueError as exc:
            return _bad_draft(exc)
        # a draft is the player's own: activity, but no broadcast (PERF-34)
        return Unchanged(warnings=warnings, activity=True)


class CampaignBattlePostbattleStepView(BattleWriteView):
    """POST `{"step": "injuries" | "xp" | "explore", "postbattle_json": {...}}`: the player has pressed Next on an
    aftermath step, so its results go to his warband now (William, 18 Nov 2026). Idempotent: a step already applied
    only saves the draft again. It holds his own rows alone, as the first half of Ready does (PERF-36), so it never
    touches the battle row: the draft saves beside it record the activity."""

    rules = (
        refuse((Battle.STATUS_CANCELED,), "Battle was canceled"),
        _skipped,
        snapshot_when_player(CONFIRMED),
        only(POSTBATTLE_OPEN, NOT_IN_POSTBATTLE),
        only_player((FINISHED,), "You must enter postbattle before applying it"),
    )
    battle_related = ("campaign__settings",)

    def post(self, request, campaign_id, battle_id, **kwargs):
        step = request.data.get("step")
        if step not in STEPS:
            return Response({"detail": "Unknown aftermath step", "code": "unknown_step"}, status=400)
        try:
            return self.answered(request, self.apply_step(request, campaign_id, battle_id, step))
        except ValueError as exc:  # raised inside the transaction, so nothing it wrote is kept (BUG-124)
            return _bad_draft(exc)

    def apply_step(self, request, campaign_id: int, battle_id: int, step: str) -> Response:
        with transaction.atomic():
            try:
                scope = self.load_scope(request, campaign_id, battle_id, lock=LOCK_PLAYER)
            except Refused as refused:
                return refused.response()
            if (refusal := self.refusal(scope)) is not None:
                return refusal
            raw_draft = request.data.get("postbattle_json", scope.player.postbattle_json)
            warnings = apply_aftermath_step(scope.battle, scope.player, raw_draft, step)
        # his warband changed (injuries, XP, gold, shards): other members' open pages of it read it again
        send_warband_changed(scope.battle.campaign_id, scope.player.warband_id, sender_socket_id(request))
        return answer(battle_snapshot(scope.battle.id), [], warnings=warnings)


class CampaignBattleFinalizePostbattleView(BattleWriteView):
    rules = (
        refuse((Battle.STATUS_CANCELED,), "Battle was canceled"),
        _skipped,
        snapshot_when_player(CONFIRMED),
        only(POSTBATTLE_OPEN, NOT_IN_POSTBATTLE),
        only_player((FINISHED,), "You must enter postbattle before finalizing"),
    )

    battle_related = ("campaign__settings",)

    def post(self, request, campaign_id, battle_id, **kwargs):
        try:
            return self.answered(request, self.finalise(request, campaign_id, battle_id))
        except ValueError as exc:  # raised inside the first transaction, so nothing it wrote is kept (BUG-124)
            return _bad_draft(exc)

    def finalise(self, request, campaign_id: int, battle_id: int) -> Response:
        """His results under his own participant lock, then the battle row for the last step only (PERF-36)."""
        with transaction.atomic():
            try:
                scope = self.load_scope(request, campaign_id, battle_id, lock=LOCK_PLAYER)
            except Refused as refused:
                return refused.response()
            if (refusal := self.refusal(scope)) is not None:
                return refusal
            raw_draft = request.data.get("postbattle_json", scope.player.postbattle_json)
            warnings = apply_player_postbattle(scope.battle, scope.player, raw_draft)  # only the steps left to apply
        with transaction.atomic():
            confirmed = confirm_postbattle(scope.battle.id, scope.player, request.user)
        changed = ALL if confirmed.battle.status == Battle.STATUS_ENDED else [scope.player.id]
        payload = snapshot(confirmed.battle, confirmed.participants)
        publish_snapshot(request, payload, confirmed.events, confirmed.version, changed, "")
        # his warband changed (results, gold, missing games counted down): other members' open pages of it follow
        send_warband_changed(scope.battle.campaign_id, scope.player.warband_id, sender_socket_id(request))
        return answer(payload, confirmed.events, warnings=warnings)


class CampaignBattleSkipPostbattleView(BattleWriteView):  # skip-postbattle/ (the page's Skip aftermath)
    rules = (
        refuse((Battle.STATUS_CANCELED,), "Battle was canceled"),
        snapshot_when_player(CONFIRMED),
        only(POSTBATTLE_OPEN, NOT_IN_POSTBATTLE),
        only_player((FINISHED,), "You must enter postbattle before leaving"),
    )

    def act(self, scope: Scope):
        return Written(skip(scope.battle, scope.player, scope.user), changed=_changed(scope))
