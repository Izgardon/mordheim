"""A player's postbattle: saving the draft, finalising it, or skipping it."""

from rest_framework.response import Response

from ..models import Battle, BattleParticipant
from ..services.broadcast import ALL
from ..services.closing import skip
from ..services.postbattle.finalise import finalise_postbattle, save_draft
from .base import BattleWriteView, Scope, Unchanged, Written
from .rules import only, only_player, refuse, refused, snapshot_when_player

CONFIRMED = BattleParticipant.STATUS_CONFIRMED_POSTBATTLE
NOT_IN_POSTBATTLE = "Battle is not in postbattle"


def _changed(scope: Scope):
    return ALL if scope.battle.status == Battle.STATUS_ENDED else [scope.player.id]


def _skipped(scope: Scope) -> Response | None:
    if scope.player.status == CONFIRMED and scope.player.skipped_postbattle:
        detail = "Your postbattle was skipped, so its results can't be applied now"
        return refused(detail, code="postbattle_skipped")
    return None


class CampaignBattlePostbattleSaveView(BattleWriteView):
    rules = (only((Battle.STATUS_POSTBATTLE,), NOT_IN_POSTBATTLE), snapshot_when_player(CONFIRMED))

    def act(self, scope: Scope):
        raw_draft = scope.request.data.get("postbattle_json", scope.player.postbattle_json)
        try:
            warnings = save_draft(scope.battle, scope.player, raw_draft)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        # a draft is the player's own: activity, but no broadcast (PERF-34)
        return Unchanged(warnings=warnings, activity=True)


class CampaignBattleFinalizePostbattleView(BattleWriteView):
    rules = (
        refuse((Battle.STATUS_CANCELED,), "Battle was canceled"),
        _skipped,
        snapshot_when_player(CONFIRMED),
        only((Battle.STATUS_POSTBATTLE,), NOT_IN_POSTBATTLE),
        only_player((BattleParticipant.STATUS_FINISHED_BATTLE,), "You must enter postbattle before finalizing"),
    )

    def post(self, request, campaign_id, battle_id, **kwargs):
        try:
            return super().post(request, campaign_id, battle_id, **kwargs)
        except ValueError as exc:  # raised inside the transaction, so nothing it wrote is kept (BUG-124)
            return Response({"detail": str(exc)}, status=400)

    def act(self, scope: Scope):
        raw_draft = scope.request.data.get("postbattle_json", scope.player.postbattle_json)
        events, warnings = finalise_postbattle(scope.battle, scope.player, raw_draft, scope.user)
        return Written(events, changed=_changed(scope), warnings=warnings)


class CampaignBattleConfirmView(BattleWriteView):
    rules = (
        refuse((Battle.STATUS_CANCELED,), "Battle was canceled"),
        snapshot_when_player(CONFIRMED),
        only((Battle.STATUS_POSTBATTLE,), NOT_IN_POSTBATTLE),
        only_player((BattleParticipant.STATUS_FINISHED_BATTLE,), "You must enter postbattle before leaving"),
    )

    def act(self, scope: Scope):
        return Written(skip(scope.battle, scope.player, scope.user), changed=_changed(scope))
