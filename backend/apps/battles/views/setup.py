"""Before the fight and around it: config, join, ready, leaving, the creator's cancel and the start (by anyone)."""

from rest_framework.response import Response

from ..models import Battle, BattleParticipant
from ..services.broadcast import ALL
from ..services.lifecycle import POSTBATTLE_APPLIED, cancel_battle, someone_finalised
from ..services.prebattle import join, leave, set_ready, start
from ..validation.config import changes_others_see, config_changes
from .base import BattleWriteView, Scope, Unchanged, Written
from .rules import creator_only, normal_flow, only, refuse, refuse_player, refused, snapshot_when

WAITING_FOR_ANSWERS = "Waiting for all participants to accept invitation"
FIGHT_OR_AFTER = (Battle.STATUS_ACTIVE, Battle.STATUS_POSTBATTLE, Battle.STATUS_ENDED)


class CampaignBattleConfigView(BattleWriteView):
    rules = (
        only(
            (Battle.STATUS_PREBATTLE, Battle.STATUS_ACTIVE, Battle.STATUS_POSTBATTLE), "Battle configuration is locked"
        ),
    )

    def act(self, scope: Scope):
        participant = scope.player
        try:
            changes = config_changes(scope.request.data, participant)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        shared_change = changes_others_see(participant, changes)
        for field, value in changes.items():
            setattr(participant, field, value)
        participant.save(update_fields=[*changes, "updated_at"])
        if not shared_change:  # notes only (or nothing): nobody else needs it (PERF-34)
            return Unchanged(activity=True)
        return Written([], changed=[participant.id], reason="participant_config_updated")


class CampaignBattleJoinView(BattleWriteView):
    rules = (
        normal_flow("Reported results cannot be joined"),
        refuse((Battle.STATUS_CANCELED, Battle.STATUS_ENDED), "Battle is closed"),
        refuse_player((BattleParticipant.STATUS_DECLINED,), "You declined this battle", code="invite_declined"),
    )

    def act(self, scope: Scope):
        joined = join(scope.battle, scope.player, scope.user)
        if not (joined.changed or joined.events):
            return Unchanged()
        opened_for_all = scope.battle.status == Battle.STATUS_PREBATTLE and joined.opened
        changed = ALL if opened_for_all else [scope.player.id]
        return Written(joined.events, changed=changed, reason="participant_joined_or_updated")


class CampaignBattleReadyView(BattleWriteView):
    rules = (
        normal_flow("Reported results do not use prebattle ready states"),
        refuse((Battle.STATUS_INVITING,), WAITING_FOR_ANSWERS),
        refuse(FIGHT_OR_AFTER, "Battle is no longer in prebattle"),
        refuse((Battle.STATUS_CANCELED,), "Battle is canceled"),
    )

    def parse(self, request):
        if "ready" not in request.data:
            return Response({"detail": "ready is required"}, status=400)
        value = request.data.get("ready")
        if isinstance(value, bool):
            return value
        lowered = value.strip().lower() if isinstance(value, str) else None
        if lowered in {"true", "1", "yes"}:
            return True
        if lowered in {"false", "0", "no"}:
            return False
        return Response({"detail": "ready must be true or false"}, status=400)

    def act(self, scope: Scope):
        if not set_ready(scope.player, self.input):
            return Unchanged()
        return Written([], changed=[scope.player.id], reason="participant_ready_changed")


class CampaignBattleCancelView(BattleWriteView):
    rules = (
        normal_flow("Reported results cannot be canceled this way"),
        refuse(FIGHT_OR_AFTER, "Cannot cancel during or after battle"),
        refuse((Battle.STATUS_CANCELED,), "Battle is already canceled"),
    )

    def act(self, scope: Scope):
        events = leave(scope.battle, scope.player, scope.user)
        if events is None:
            return Unchanged()
        changed = ALL if events else [scope.player.id]
        return Written(events, changed=changed, reason="participant_canceled_prebattle")


def _nothing_applied(scope: Scope) -> Response | None:
    """A player may apply his postbattle while the others still fight (decision 4); after that the battle can't be
    cancelled, as his results would stay applied (BUG-09). A battle manager ends it instead (finish/)."""
    if scope.battle.status == Battle.STATUS_ACTIVE and someone_finalised(scope.battle.id):
        return refused(POSTBATTLE_APPLIED, code="postbattle_applied")
    return None


class CampaignBattleCreatorCancelView(BattleWriteView):
    rules = (
        creator_only("Only the battle creator can cancel this battle"),
        normal_flow("Reported results cannot be canceled this way"),
        snapshot_when(Battle.STATUS_CANCELED),
        refuse((Battle.STATUS_ENDED,), "Battle is already ended"),
        refuse(  # decision 3, BUG-09
            (Battle.STATUS_POSTBATTLE,),
            "Postbattle can't be cancelled; close it instead",
            code="use_close_postbattle",
        ),
        _nothing_applied,
    )

    def act(self, scope: Scope):
        return Written([cancel_battle(scope.battle, actor_user=scope.user, mode="creator")], changed=ALL)


class CampaignBattleStartView(BattleWriteView):
    """POST: any participant still in the battle starts it once everyone is ready (decision 4; the page asks him to
    confirm when someone else created it)."""

    rules = (
        refuse_player(BattleParticipant.LEFT_STATUSES, "You are no longer in this battle", code="not_in_battle"),
        normal_flow("Reported results do not have an active battle phase"),
        refuse(FIGHT_OR_AFTER, "Battle already started"),
        refuse((Battle.STATUS_INVITING,), WAITING_FOR_ANSWERS),
        refuse((Battle.STATUS_CANCELED,), "Battle is canceled"),
    )

    def act(self, scope: Scope):
        return Written(start(scope.battle, scope.user), changed=ALL)
