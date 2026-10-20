"""Reads behind the campaign pages: the campaign as a member sees it, and the overview and members payloads.

Each read costs a fixed number of queries, whatever the number of rows (CAMP-TEST-01, -03).
"""

from datetime import datetime
from typing import Any

from django.db.models import CharField, Count, F, FilteredRelation, Model, Prefetch, Q, QuerySet, Value
from django.db.models.functions import Cast, Coalesce, Concat, Lower, NullIf, Trim
from django.utils import timezone

from apps.battles.models import Battle, BattleParticipant
from apps.battles.services.setup import busy_participations
from apps.users.names import display_name
from apps.warbands.models import Henchman, Hero, HiredSword, Warband
from apps.warbands.services.summary import load_warband_units

from .models import Campaign, CampaignMembership, CampaignMembershipPermission, PivotalMoment


def campaigns_for_user(user: Any) -> QuerySet[Campaign]:
    """The user's campaigns with their settings, his `role` and their `player_count` (CampaignSerializer)."""
    return (
        Campaign.objects.select_related("settings")
        .prefetch_related("settings__item_settings")
        .annotate(membership_for_user=FilteredRelation("memberships", condition=Q(memberships__user=user)))
        .filter(membership_for_user__isnull=False)
        .annotate(player_count=Count("memberships", distinct=True), role=F("membership_for_user__role__slug"))
    )


def campaign_for_user(campaign_id: int, user: Any) -> Campaign | None:
    return campaigns_for_user(user).filter(id=campaign_id).first()


def format_short_date(value: datetime | None) -> str:
    if not value:
        return "-"
    if timezone.is_aware(value):
        value = timezone.localtime(value)
    return value.strftime("%d/%m/%y")


# Players (the overview's roster and the name pickers)


def _busy_battle_fields(busy: tuple | None) -> dict:
    battle_id, battle_status, last_activity_at = busy or (None, None, None)
    return {
        "battle_busy_status": battle_status,
        "battle_busy_battle_id": battle_id,
        "battle_busy_last_activity_at": last_activity_at,
    }


def campaign_memberships(campaign_id: int) -> list[CampaignMembership]:
    """The campaign's members with their users, in the players list's order."""
    rows = CampaignMembership.objects.filter(campaign_id=campaign_id).select_related("user")
    return list(rows.order_by("user__first_name", "user__email"))


def _warbands_by_user(campaign_id: int) -> dict[int, dict[str, Any]]:
    warbands = list(
        Warband.objects.filter(campaign_id=campaign_id).only("id", "name", "faction", "user_id", "wins", "losses")
    )
    units_by_warband = load_warband_units(warband.id for warband in warbands)
    return {
        warband.user_id: {
            "id": warband.id,
            "name": warband.name,
            "faction": warband.faction,
            "wins": warband.wins,
            "losses": warband.losses,
            "rating": units_by_warband[warband.id].rating,
        }
        for warband in warbands
    }


def _busy_by_user(campaign_id: int, user_ids: list[int]) -> dict[int, tuple]:
    """Each member's most recent unfinished battle: id, status, last activity (BUG-10)."""
    busy_entries = (
        busy_participations(campaign_id, user_ids)  # the busy rule battles warn with (decision 1)
        .order_by("-battle__created_at")
        .values_list("user_id", "battle_id", "battle__status", "battle__last_activity_at")
    )
    busy_by_user: dict[int, tuple] = {}
    for user_id, *battle in busy_entries:
        busy_by_user.setdefault(user_id, tuple(battle))
    return busy_by_user


def players_payload(campaign_id: int, memberships: list[CampaignMembership]) -> list[dict[str, Any]]:
    """Each member with his warband (and its rating) and whether he's busy in a battle."""
    warband_by_user = _warbands_by_user(campaign_id)
    busy_by_user = _busy_by_user(campaign_id, [member.user_id for member in memberships])
    return [
        {
            "id": member.user_id,
            "name": display_name(member.user),
            "warband": warband_by_user.get(member.user_id),
            "battle_busy": member.user_id in busy_by_user,
            **_busy_battle_fields(busy_by_user.get(member.user_id)),
        }
        for member in memberships
    ]


def members_payload(campaign_id: int) -> list[dict[str, Any]]:
    """The members list for owners and admins: role, grants, email and warband."""
    memberships = (
        CampaignMembership.objects.filter(campaign_id=campaign_id)
        .select_related("user", "role")
        .prefetch_related(
            Prefetch("permissions", queryset=CampaignMembershipPermission.objects.select_related("permission"))
        )
        .order_by("role__slug", "user__first_name", "user__email")
    )
    warband_map = {w.user_id: w for w in Warband.objects.filter(campaign_id=campaign_id).only("id", "name", "user_id")}
    return [
        {
            "id": member.user_id,
            "name": display_name(member.user),
            "email": member.user.email,
            "role": member.role.slug,
            "permissions": [entry.permission.code for entry in member.permissions.all()],
            "warband_id": warband_map[member.user_id].id if member.user_id in warband_map else None,
            "warband_name": warband_map[member.user_id].name if member.user_id in warband_map else None,
        }
        for member in memberships
    ]


# Battle history


HISTORY_UNREAD_FIELDS = (
    "selected_unit_keys_json",
    "unit_information_json",
    "custom_units_json",
    "roster_json",
    "battle_notes",
)


def _count(value: Any) -> int:
    """A non-negative whole number from a stored postbattle value; 0 when it isn't one."""
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


def _dice_values(exploration: Any) -> list[int]:
    raw = exploration.get("dice_values", []) if isinstance(exploration, dict) else []
    values = []
    for entry in raw if isinstance(raw, list) else []:
        try:
            values.append(int(entry))
        except (TypeError, ValueError):
            continue
    return values


def _history_participant(participant: BattleParticipant) -> dict[str, Any]:
    postbattle_json = participant.postbattle_json if isinstance(participant.postbattle_json, dict) else {}
    unit_results = postbattle_json.get("unit_results", {})
    row: dict[str, Any] = {"warband_id": participant.warband_id, "warband_name": participant.warband.name}
    if not isinstance(unit_results, dict) or not unit_results:
        return {**row, "kills": None, "ooas": None, "deaths": [], "xp_gain": None, "exploration": []}
    results = [result for result in unit_results.values() if isinstance(result, dict)]
    deaths = [str(result.get("unit_name", "")).strip() for result in results if bool(result.get("dead", False))]
    return {
        **row,
        "kills": sum(_count(result.get("kill_count", 0)) for result in results),
        "ooas": sum(1 for result in results if bool(result.get("out_of_action", False))),
        "deaths": [name for name in deaths if name],
        "xp_gain": sum(_count(result.get("xp_earned", 0)) for result in results),
        "exploration": _dice_values(postbattle_json.get("exploration", {})),
    }


def battle_history_payload(campaign_id: int) -> list[dict[str, Any]]:
    """The campaign's ended battles, newest first, each with its winners and every participant's totals."""
    participants = (
        BattleParticipant.objects.select_related("warband")
        .filter(removed_from_record=False)  # without those a battle manager took off the record (BATL-NEW-04)
        .defer(*HISTORY_UNREAD_FIELDS)  # only postbattle_json is read (PERF-45)
        .order_by("id")
    )
    battles = (
        Battle.objects.filter(campaign_id=campaign_id, status=Battle.STATUS_ENDED)
        .prefetch_related(Prefetch("participants", queryset=participants))
        .order_by("-ended_at", "-created_at", "-id")
    )
    payload = []
    for battle in battles:
        rows = list(battle.participants.all())
        winner_ids = set(battle.winner_warband_ids_json or [])
        payload.append(
            {
                "id": battle.id,
                "scenario": battle.scenario,
                "winners": [row.warband.name for row in rows if row.warband_id in winner_ids],
                "date": format_short_date(battle.ended_at or battle.created_at),
                "participants": [_history_participant(row) for row in rows],
            }
        )
    return payload


# Pivotal moments and top killers


def pivotal_moments(campaign_id: int) -> QuerySet[PivotalMoment]:
    rows = PivotalMoment.objects.filter(campaign_id=campaign_id).select_related("battle", "warband")
    return rows.order_by("-battle_ended_at", "id")


_EMPTY = Value("", output_field=CharField())
KILLER_COLUMNS = (
    "unit_id_value",
    "unit_kind_value",
    "unit_name_value",
    "unit_type_value",
    "warband_id_value",
    "warband_name_value",
    "kills_value",
    "unit_name_sort",
    "warband_name_sort",
)


def _unit_name(name_prefix: str) -> Coalesce:
    """The unit's trimmed name, else "<prefix><id>" (e.g. "Hero 12")."""
    return Coalesce(NullIf(Trim("name"), _EMPTY), Concat(Value(name_prefix), Cast("id", CharField())))


def _killer_rows(
    campaign_id: int, model: type[Model], kind: str, name_prefix: str, unit_type_field: str, warband_path: str
):
    """One unit kind's units with kills in the campaign, in the shape the union below orders and cuts (IMP-67)."""
    return (
        model._default_manager.filter(**{f"{warband_path}__campaign_id": campaign_id}, kills__gt=0)
        .annotate(
            unit_id_value=F("id"),
            unit_kind_value=Value(kind, output_field=CharField()),
            unit_name_value=_unit_name(name_prefix),
            unit_type_value=NullIf(Trim(unit_type_field), _EMPTY),
            warband_id_value=F(f"{warband_path}_id"),
            warband_name_value=F(f"{warband_path}__name"),
            kills_value=F("kills"),
            unit_name_sort=Lower(_unit_name(name_prefix)),
            warband_name_sort=Lower(f"{warband_path}__name"),
        )
        .values(*KILLER_COLUMNS)
    )


KILLER_KINDS = (  # model, kind, name prefix, unit type field, path to the warband
    (Hero, "hero", "Hero ", "unit_type", "warband"),
    (HiredSword, "hired_sword", "Hired Sword ", "unit_type", "warband"),
    (Henchman, "henchman", "Henchman ", "group__unit_type", "group__warband"),
)


def _top_killer(row: dict[str, Any]) -> dict[str, Any]:
    unit_type = str(row["unit_type_value"] or "").strip()
    return {
        "unit_id": row["unit_id_value"],
        "unit_kind": row["unit_kind_value"],
        "unit_name": row["unit_name_value"],
        "unit_type": unit_type or None,
        "warband_id": row["warband_id_value"],
        "warband_name": row["warband_name_value"],
        "kills": row["kills_value"],
    }


def top_killers_payload(campaign_id: int, limit: int = 5) -> list[dict[str, Any]]:
    """The campaign's units with the most kills, of every kind, in one query."""
    hero_rows, *other_rows = (_killer_rows(campaign_id, *kind) for kind in KILLER_KINDS)
    ordered = hero_rows.union(*other_rows, all=True).order_by(
        "-kills_value", "unit_name_sort", "warband_name_sort", "unit_id_value"
    )
    return [_top_killer(row) for row in ordered[:limit]]
