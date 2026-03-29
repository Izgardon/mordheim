from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.battles.models import BattleEvent
from apps.warbands.models import Henchman, HenchmenGroup, Hero, HiredSword, Warband
from apps.warbands.permissions import CanViewWarband

from .mixins import WarbandObjectMixin


def _serialize_named_kills(events) -> list[dict]:
    victim_warband_ids: set[int] = set()
    normalized_events: list[tuple[str, int | None, str]] = []

    for event in events:
        payload = event.payload_json if isinstance(event.payload_json, dict) else {}
        victim = payload.get("victim", {})
        if not isinstance(victim, dict):
            continue

        victim_name = str(victim.get("name", "") or "").strip()
        if not victim_name:
            continue

        victim_warband_id = victim.get("warband_id")
        try:
            parsed_victim_warband_id = int(victim_warband_id)
        except (TypeError, ValueError):
            continue
        if parsed_victim_warband_id <= 0:
            continue

        scenario_name = str(getattr(event.battle, "scenario", "") or "").strip()
        normalized_events.append((victim_name, parsed_victim_warband_id, scenario_name))
        victim_warband_ids.add(parsed_victim_warband_id)

    warband_names = {
        warband_id: warband_name
        for warband_id, warband_name in Warband.objects.filter(id__in=victim_warband_ids).values_list("id", "name")
    }

    named_kills: list[dict] = []
    for victim_name, victim_warband_id, scenario_name in normalized_events:
        victim_warband_name = str(warband_names.get(victim_warband_id, "") or "").strip()
        if not victim_warband_name:
            continue
        named_kills.append(
            {
                "victim_name": victim_name,
                "victim_warband_name": victim_warband_name,
                "scenario_name": scenario_name,
            }
        )
    return named_kills


def _kill_history_response(*, total_kills: int, events) -> Response:
    named_kills = _serialize_named_kills(events)
    return Response(
        {
            "total_kills": max(0, int(total_kills or 0)),
            "named_kills_count": len(named_kills),
            "named_kills": named_kills,
        }
    )


class WarbandHeroKillHistoryView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id, hero_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        hero = Hero.objects.filter(id=hero_id, warband=warband).first()
        if not hero:
            return Response({"detail": "Not found"}, status=404)

        events = (
            BattleEvent.objects.filter(
                type=BattleEvent.TYPE_UNIT_KILL_RECORDED,
                payload_json__killer__unit_type="hero",
                payload_json__killer__unit_id=hero.id,
            )
            .select_related("battle")
            .order_by("-created_at", "-id")
        )

        return _kill_history_response(total_kills=hero.kills or 0, events=events)


class WarbandHiredSwordKillHistoryView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id, hired_sword_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        hired_sword = HiredSword.objects.filter(id=hired_sword_id, warband=warband).first()
        if not hired_sword:
            return Response({"detail": "Not found"}, status=404)

        events = (
            BattleEvent.objects.filter(
                type=BattleEvent.TYPE_UNIT_KILL_RECORDED,
                payload_json__killer__unit_type="hired_sword",
                payload_json__killer__unit_id=hired_sword.id,
            )
            .select_related("battle")
            .order_by("-created_at", "-id")
        )

        return _kill_history_response(total_kills=hired_sword.kills or 0, events=events)


class WarbandHenchmenGroupKillHistoryView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id, group_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        group = HenchmenGroup.objects.filter(id=group_id, warband=warband).first()
        if not group:
            return Response({"detail": "Not found"}, status=404)

        members = list(Henchman.objects.filter(group=group).only("id", "kills"))
        member_ids = [member.id for member in members]
        total_kills = sum(int(member.kills or 0) for member in members)
        if not member_ids:
            return _kill_history_response(total_kills=total_kills, events=[])

        events = (
            BattleEvent.objects.filter(
                type=BattleEvent.TYPE_UNIT_KILL_RECORDED,
                payload_json__killer__unit_type="henchman",
                payload_json__killer__unit_id__in=member_ids,
            )
            .select_related("battle")
            .order_by("-created_at", "-id")
        )

        return _kill_history_response(total_kills=total_kills, events=events)
