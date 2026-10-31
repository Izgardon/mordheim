"""The fight: single-use items used, out of action and kills (finishing is views/finishing.py)."""

from rest_framework import status
from rest_framework.response import Response

from ..models import Battle, BattleEvent, BattleParticipant
from ..models.kill import HOWS
from ..services.broadcast import ALL
from ..services.combat import record_item_use, record_kill, set_out_of_action
from ..services.dismount import set_dismounted
from ..services.errors import BattleError, battle_status_changed
from ..services.item_use import check_payload_size
from ..services.neutrals import (
    add_creature,
    add_group,
    change_creature,
    creature_change_request,
    new_group_request,
    remove_group,
)
from ..services.rounds import ACTIONS, change_round
from ..validation.coerce import coerce_bool
from ..validation.unit_keys import parse_unit_key
from .base import BattleWriteView, Scope, Unchanged, Written
from .rules import only, only_player

INGAME_EVENT_TYPES = {BattleEvent.TYPE_ITEM_USED}  # kills go through unit-kill/ (the legacy types are gone)
NOT_ACTIVE = "Battle is not active"
NOT_IN_BATTLE = "You are not currently in battle"
KILL_HOWS = HOWS  # how the kill sheet says it was done (melee, shooting, magic or other), optional


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


class CampaignBattleUnitDismountView(BattleWriteView):
    """POST unit-dismount/ {unit_key, dismounted}: a rider off his mount for the rest of the battle, or back on it
    (services/dismount.py); the other players see it through the broadcast."""

    rules = CampaignBattleUnitOoaView.rules

    def parse(self, request):
        try:
            unit = parse_unit_key(request.data.get("unit_key"))
            dismounted = coerce_bool(request.data.get("dismounted"), field_name="dismounted")
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        return unit, dismounted

    def act(self, scope: Scope):
        unit, dismounted = self.input
        if not set_dismounted(scope.player, unit, dismounted):
            return Unchanged()
        return Written([], changed=[scope.player.id], reason="unit_dismounted")


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
    neutral_key = _text(data, "victim_neutral_key", 40) if victim is None else ""
    notes = _text(data, "notes", 500)
    if victim is None and not (victim_name or neutral_key):
        raise ValueError("Either victim_unit_key, victim_neutral_key or victim_name is required")
    earned_xp = coerce_bool(data.get("earned_xp", True), field_name="earned_xp")
    how = data.get("how") or ""
    if how and how not in KILL_HOWS:
        raise ValueError(f"how must be one of {', '.join(KILL_HOWS)}")
    source = "postbattle" if data.get("source") == "postbattle" else "battle"
    return {
        "killer": killer,
        "victim": victim,
        "victim_name": victim_name,
        "victim_neutral_key": neutral_key,
        "notes": notes,
        "earned_xp": earned_xp,
        "source": source,
        "how": how,
    }


def _kill_refusal(scope: Scope, source: str) -> Response | None:
    """Kills are tapped in an active battle, or added in the killer's own postbattle when the request says
    `source: "postbattle"` (decision 5, BATL-NEW-06), so a phone that slept through End isn't taken for one. His
    postbattle starts when he finishes his battle, while the others may still fight (decision 4)."""
    battle, participant = scope.battle, scope.player
    if source == "postbattle":
        in_own_postbattle = participant.status == BattleParticipant.STATUS_FINISHED_BATTLE
        if battle.status in (Battle.STATUS_ACTIVE, Battle.STATUS_POSTBATTLE) and in_own_postbattle:
            return None
        detail = "Kills can be added in postbattle only until you finalise"
        return Response({"detail": detail, "code": "not_in_postbattle"}, status=400)
    if battle.status != Battle.STATUS_ACTIVE:
        return battle_status_changed(battle, NOT_ACTIVE).response()
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
        events, changed = record_kill(scope.battle, scope.player, self.input, scope.user)
        return Written(events, changed=changed, status=status.HTTP_201_CREATED)


class CampaignBattleRoundView(BattleWriteView):
    """POST round/ {action}: ask for the next round, agree to it, start it anyway (force) or take the request back
    (withdraw), services/rounds.py. A new round stands every fighter's units up a step, so it changes them all."""

    rules = CampaignBattleUnitOoaView.rules

    def parse(self, request):
        action = request.data.get("action")
        if action not in ACTIONS:
            return Response({"detail": f"action must be one of {', '.join(ACTIONS)}"}, status=400)
        return action

    def act(self, scope: Scope):
        events, started = change_round(scope.battle, self.input, scope.user)
        if not events:
            return Unchanged()
        return Written(events, changed=ALL if started else (), reason="round_changed")


class CampaignBattleNeutralGroupsView(BattleWriteView):
    """POST neutral-groups/ {name, creature_type, count, wounds, stats?}: a group of creatures nobody plays
    (services/neutrals.py), added by anyone in the fight."""

    rules = CampaignBattleUnitOoaView.rules

    def parse(self, request):
        try:
            return new_group_request(request.data)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

    def act(self, scope: Scope):
        event = add_group(scope.battle, self.input, scope.user)
        return Written([event], status=status.HTTP_201_CREATED)


class CampaignBattleNeutralGroupView(BattleWriteView):
    """POST neutral-groups/<key>/ {add: true} adds a creature to the group; {remove: true} takes the group away."""

    rules = CampaignBattleUnitOoaView.rules

    def parse(self, request):
        if request.data.get("remove") is True:
            return "remove"
        if request.data.get("add") is True:
            return "add"
        return Response({"detail": "Send add: true or remove: true"}, status=400)

    def act(self, scope: Scope):
        group_key = self.kwargs["group_key"]
        if self.input == "remove":
            remove_group(scope.battle, group_key)
            return Written([], reason="neutral_group_removed")
        return Written([add_creature(scope.battle, group_key, scope.user)], status=status.HTTP_201_CREATED)


class CampaignBattleNeutralCreatureView(BattleWriteView):
    """POST neutral-creatures/<key>/ {status?, wounds?}: a creature's status (standing, knocked_down, stunned,
    out_of_action) or wounds, for everyone to see."""

    rules = CampaignBattleUnitOoaView.rules

    def parse(self, request):
        try:
            return creature_change_request(request.data)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

    def act(self, scope: Scope):
        changed, events = change_creature(scope.battle, self.kwargs["creature_key"], self.input, scope.user)
        if not changed:
            return Unchanged()
        return Written(events, reason="neutral_creature_changed")
