"""The fight: single-use items used, out of action, kills, End battle."""

from rest_framework import status
from rest_framework.response import Response

from ..models import Battle, BattleEvent, BattleParticipant
from ..services.broadcast import ALL
from ..services.combat import enter_postbattle, record_item_use, record_kill, set_out_of_action
from ..services.errors import BattleError
from ..services.item_use import check_payload_size
from ..validation.coerce import coerce_bool
from ..validation.unit_keys import parse_unit_key
from .base import BattleWriteView, Scope, Unchanged, Written
from .rules import creator_only, only, only_player, refuse, snapshot_when

INGAME_EVENT_TYPES = {BattleEvent.TYPE_ITEM_USED}  # kills go through unit-kill/ (the legacy types are gone)
NOT_ACTIVE = "Battle is not active"
NOT_IN_BATTLE = "You are not currently in battle"


class CampaignBattleEventCreateView(BattleWriteView):
    def parse(self, request):
        event_type = request.data.get("type")
        payload = request.data.get("payload_json", {})
        if event_type not in INGAME_EVENT_TYPES:
            return Response({"detail": "Unsupported event type"}, status=400)
        if payload is None:
            payload = {}
        if not isinstance(payload, dict):
            return Response({"detail": "payload_json must be an object"}, status=400)
        try:
            check_payload_size(payload)
        except BattleError as refused:
            return refused.response()
        return payload

    def act(self, scope: Scope):
        event = record_item_use(scope.battle, scope.player, self.input, scope.user)
        return Written([event], status=status.HTTP_201_CREATED)


class CampaignBattleUnitOoaView(BattleWriteView):
    rules = (
        only((Battle.STATUS_ACTIVE,), NOT_ACTIVE),
        only_player((BattleParticipant.STATUS_IN_BATTLE,), NOT_IN_BATTLE),
    )

    def parse(self, request):
        try:
            unit = parse_unit_key(request.data.get("unit_key"))
            out_of_action = coerce_bool(request.data.get("out_of_action"), field_name="out_of_action")
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        return unit, out_of_action

    def act(self, scope: Scope):
        unit, out_of_action = self.input
        events = set_out_of_action(scope.battle, scope.player, unit, out_of_action, scope.user)
        if not events:
            return Unchanged()
        return Written(events, changed=[scope.player.id], status=status.HTTP_201_CREATED)


def _text(data, field: str, limit: int) -> str:
    raw = data.get(field, "")
    if raw is None:
        raw = ""
    if not isinstance(raw, str):
        raise ValueError(f"{field} must be a string")
    text = raw.strip()
    if len(text) > limit:
        raise ValueError(f"{field} must be at most {limit} characters")
    return text


def _kill_request(data) -> dict:
    """A kill as `unit-kill/` sends it; ValueError with the message to answer."""
    killer = parse_unit_key(data.get("killer_unit_key"))
    victim = parse_unit_key(data.get("victim_unit_key")) if data.get("victim_unit_key") else None
    victim_name = _text(data, "victim_name", 120)
    notes = _text(data, "notes", 500)
    if victim is None and not victim_name:
        raise ValueError("Either victim_unit_key or victim_name is required")
    earned_xp = coerce_bool(data.get("earned_xp", True), field_name="earned_xp")
    source = "postbattle" if data.get("source") == "postbattle" else "battle"
    return {
        "killer": killer,
        "victim": victim,
        "victim_name": victim_name,
        "notes": notes,
        "earned_xp": earned_xp,
        "source": source,
    }


def _kill_refusal(scope: Scope, source: str) -> Response | None:
    """Kills are tapped in an active battle, or added in the killer's own postbattle when the request says
    `source: "postbattle"` (decision 5, BATL-NEW-06), so a phone that slept through End isn't taken for one."""
    battle, participant = scope.battle, scope.player
    if source == "postbattle":
        in_own_postbattle = participant.status == BattleParticipant.STATUS_FINISHED_BATTLE
        if battle.status == Battle.STATUS_POSTBATTLE and in_own_postbattle:
            return None
        detail = "Kills can be added in postbattle only until you finalise"
        return Response({"detail": detail, "code": "not_in_postbattle"}, status=400)
    if battle.status != Battle.STATUS_ACTIVE:
        return Response({"detail": NOT_ACTIVE}, status=400)
    if participant.status != BattleParticipant.STATUS_IN_BATTLE:
        return Response({"detail": NOT_IN_BATTLE}, status=400)
    return None


class CampaignBattleUnitKillView(BattleWriteView):
    def parse(self, request):
        try:
            return _kill_request(request.data)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

    def act(self, scope: Scope):
        if (refusal := _kill_refusal(scope, self.input["source"])) is not None:
            return refusal
        events = record_kill(scope.battle, scope.player, self.input, scope.user)
        return Written(events, changed=[scope.player.id], status=status.HTTP_201_CREATED)


class CampaignBattleFinishView(BattleWriteView):
    rules = (
        refuse((Battle.STATUS_INVITING, Battle.STATUS_PREBATTLE, Battle.STATUS_CANCELED), "Battle has not started"),
        snapshot_when(Battle.STATUS_ENDED, Battle.STATUS_POSTBATTLE),
        only((Battle.STATUS_ACTIVE,), NOT_ACTIVE),
        creator_only("Only the battle creator can end the active battle"),  # decision 4 opens it up (PR C)
    )

    def parse(self, request):
        winner_ids = request.data.get("winner_warband_ids")
        if not isinstance(winner_ids, list):  # [] is "No winner" (decision 8)
            return Response({"detail": "winner_warband_ids must be a list"}, status=400)
        normalized: list[int] = []
        for raw_winner_id in winner_ids:
            try:
                winner_id = int(raw_winner_id)
            except (TypeError, ValueError):
                winner_id = 0
            if winner_id <= 0:
                return Response({"detail": "winner_warband_ids must contain integers"}, status=400)
            if winner_id not in normalized:
                normalized.append(winner_id)
        return normalized

    def act(self, scope: Scope):
        return Written(enter_postbattle(scope.battle, self.input, scope.user), changed=ALL)
