"""Closing postbattle for everyone (decision 3, BUG-09, BATL-TWEAK-02): the way out of a postbattle, since
cancelling refuses one. Whoever hasn't finished is skipped and the battle ends (services/closing.py)."""

from rest_framework.response import Response

from ..models import Battle
from ..services.broadcast import ALL
from ..services.closing import close_postbattle
from .base import BattleWriteView, Scope, Written
from .rules import only, refused, snapshot_when


def _creator_or_manager(scope: Scope) -> Response | None:
    if scope.is_creator or scope.manages_battles:
        return None
    detail = "Only the battle's creator or a battle manager can close postbattle"
    return refused(detail, code="not_allowed", status=403)


class CampaignBattleClosePostbattleView(BattleWriteView):
    """POST: the battle's creator, or anyone with manage_battles, closes postbattle for everyone."""

    in_battle = False  # a battle manager needn't be in the battle
    rules = (
        _creator_or_manager,
        snapshot_when(Battle.STATUS_ENDED),
        only((Battle.STATUS_POSTBATTLE,), "Battle is not in postbattle"),
    )

    def act(self, scope: Scope):
        return Written(close_postbattle(scope.battle, actor_user=scope.user, mode="closed"), changed=ALL)
