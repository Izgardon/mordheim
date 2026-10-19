"""Finishing a battle (decision 4): each player finishes his own (`finish-mine/`), the last one confirms the results
(`results/`), and a battle manager can end a stuck fight with its results (`finish/`, BATL-NEW-03). There is no End
button for players (services/finishing.py)."""

from rest_framework.response import Response

from ..models import Battle, BattleParticipant
from ..serializers import snapshot_participants
from ..services.broadcast import ALL
from ..services.errors import BattleError
from ..services.finishing import check_sides, confirm_results, end_fight, finish_player, results_sides
from ..services.postbattle.guides import postbattle_guides
from ..validation.results import parse_declared_result, parse_results
from .base import BattleWriteView, Scope, Unchanged, Written
from .rules import normal_flow, only, only_player, refuse, refused, snapshot_when, snapshot_when_player

NOT_ACTIVE = "Battle is not active"
NOT_STARTED = (Battle.STATUS_INVITING, Battle.STATUS_PREBATTLE)


class CampaignBattleFinishMineView(BattleWriteView):
    """POST `{"result": "won" | "lost" | "undecided"}`: the player finishes his battle and goes to his own
    postbattle while the others play on; the last one to finish ends the fight and is asked to confirm the
    results (`confirm_results` in his answer)."""

    battle_related = ("campaign__settings",)  # the postbattle guides (item 8)
    rules = (
        normal_flow("Reported results do not have an active battle phase"),
        refuse(NOT_STARTED, "Battle has not started"),
        refuse((Battle.STATUS_CANCELED,), "Battle is canceled"),
        snapshot_when_player(BattleParticipant.STATUS_FINISHED_BATTLE, BattleParticipant.STATUS_CONFIRMED_POSTBATTLE),
        only((Battle.STATUS_ACTIVE,), NOT_ACTIVE),
        only_player((BattleParticipant.STATUS_IN_BATTLE,), "You are not currently in battle"),
    )

    def parse(self, request):
        try:
            return parse_declared_result(request.data)
        except BattleError as refusal:
            return refusal.response()

    def act(self, scope: Scope):
        finished = finish_player(scope.battle, scope.player, self.input, scope.user)
        if not finished.fight_over:  # his postbattle starts now: what it suggests comes with the answer (item 8)
            mine = postbattle_guides(scope.battle, user_id=scope.user.id)
            return Written(finished.events, changed=[scope.player.id], body=mine.answer_for(scope.user.id))
        guides = postbattle_guides(scope.battle)
        body = {"confirm_results": results_sides(scope.battle, finished.participants), **guides.answer_for(scope.user.id)}  # fmt: skip
        return Written(finished.events, changed=ALL, body=body, postbattle=guides.broadcast())


def _confirmer_or_manager(scope: Scope) -> Response | None:
    if scope.battle.results_confirmer_id == scope.user.id or scope.manages_battles:
        return None
    detail = "Only the last player to finish, or a battle manager, can confirm the results"
    return refused(detail, code="not_allowed", status=403)


def _parsed_results(request, *, legacy_winners: bool = False):
    try:
        return parse_results(request.data, legacy_winners=legacy_winners)
    except BattleError as refusal:
        return refusal.response()


class CampaignBattleResultsView(BattleWriteView):
    """POST `{"winners": [...], "losers": [...]}`: the results from the Confirm results modal, until the battle ends.
    The battle ends now if everyone has finished postbattle."""

    in_battle = False  # a battle manager needn't be in the battle
    battle_related = ("campaign__settings",)
    rules = (
        normal_flow("Reported results are confirmed by approving them"),
        _confirmer_or_manager,
        only((Battle.STATUS_POSTBATTLE,), "Results can be confirmed in postbattle, until the battle ends"),
    )

    def parse(self, request):
        return _parsed_results(request)

    def act(self, scope: Scope):
        events = confirm_results(scope.battle, self.input, scope.user)
        if not events:
            return Unchanged()
        if scope.battle.status == Battle.STATUS_ENDED:
            return Written(events, changed=ALL)
        guides = postbattle_guides(scope.battle)  # the winners changed what is suggested (Winning Leader, a die)
        return Written(events, body=guides.answer_for(scope.user.id), postbattle=guides.broadcast())


def _manager_only(scope: Scope) -> Response | None:
    if scope.manages_battles:
        return None
    detail = "Players finish their own battle; only a battle manager can end it for everyone"
    return refused(detail, code="not_allowed", status=403)


class CampaignBattleFinishView(BattleWriteView):
    """POST `{"winners": [...], "losers": [...]}` (or the older `winner_warband_ids`): a battle manager ends a stuck
    fight with its results; everyone still fighting goes to postbattle (BATL-NEW-03)."""

    in_battle = False
    battle_related = ("campaign__settings",)
    rules = (
        _manager_only,
        refuse((*NOT_STARTED, Battle.STATUS_CANCELED), "Battle has not started"),
        snapshot_when(Battle.STATUS_ENDED, Battle.STATUS_POSTBATTLE),
        only((Battle.STATUS_ACTIVE,), NOT_ACTIVE),
    )

    def parse(self, request):
        return _parsed_results(request, legacy_winners=True)

    def act(self, scope: Scope):
        check_sides(snapshot_participants().filter(battle_id=scope.battle.id), self.input)
        events = end_fight(scope.battle, self.input.winners, scope.user, results_pending=False, mode="manager")
        guides = postbattle_guides(scope.battle)
        return Written(events, changed=ALL, body=guides.answer_for(scope.user.id), postbattle=guides.broadcast())
