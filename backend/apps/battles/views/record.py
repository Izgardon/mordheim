"""An ended battle's record, read and edited by a battle manager (`GET` / `PATCH record/`, BATL-NEW-04): only that
battle's record changes, nothing is recalculated (services/record.py)."""

from rest_framework.response import Response

from ..models import Battle
from ..services.broadcast import ALL
from ..services.errors import BattleError
from ..services.record import edit_record, record_participants, record_payload
from ..validation.record import parse_record_edit
from .base import BattleWriteView, Scope, Unchanged, Written
from .rules import only, refused


def _manager_only(scope: Scope) -> Response | None:
    if scope.manages_battles:
        return None
    return refused("Only a battle manager can edit a battle's record", code="not_allowed", status=403)


class CampaignBattleRecordView(BattleWriteView):
    in_battle = False  # a battle manager needn't have played in it
    http_method_names = ["get", "patch", "options"]
    rules = (_manager_only, only((Battle.STATUS_ENDED,), "Only an ended battle's record can be edited"))

    def get(self, request, campaign_id, battle_id):
        scope = self.read(request, campaign_id, battle_id)
        if not isinstance(scope, Scope):
            return scope
        if (refusal := self.refusal(scope)) is not None:
            return refusal
        return Response(record_payload(scope.battle, record_participants(scope.battle)))

    def patch(self, request, campaign_id, battle_id):
        return self.post(request, campaign_id, battle_id)

    def parse(self, request):
        try:
            return parse_record_edit(request.data)
        except BattleError as refusal:
            return refusal.response()

    def act(self, scope: Scope):
        events, participants = edit_record(scope.battle, self.input, scope.user)
        body = {"record": record_payload(scope.battle, participants)}
        if not events:
            return Unchanged(body=body)
        return Written(events, changed=ALL, body=body)
