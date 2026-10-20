from django.db import transaction
from django.db.models import CharField, Count, F, FilteredRelation, Prefetch, Q, Value
from django.db.models.functions import Cast, Coalesce, Concat, Lower, NullIf, Trim
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.battles.models import Battle, BattleParticipant
from apps.battles.serializers import serialize_battle, serialize_participant
from apps.battles.services.broadcast import ALL, bump_state_version
from apps.battles.services.capabilities import manager_actions
from apps.battles.services.expiry import expire_overdue
from apps.battles.services.lifecycle import POSTBATTLE_APPLIED, cancel_battle, someone_finalised
from apps.battles.services.setup import busy_participations
from apps.battles.views.responses import broadcast_response, response_with_snapshot
from apps.core.throttling import (
    BATTLE_WRITE_THROTTLE_CLASSES,
    CAMPAIGN_CHAT_THROTTLE_CLASSES,
    CAMPAIGN_PING_THROTTLE_CLASSES,
    MethodScopedThrottleMixin,
)
from apps.realtime.services import send_campaign_chat_message, send_campaign_ping
from apps.users.names import display_name
from apps.warbands.models import Henchman, Hero, HiredSword, Warband
from apps.warbands.serializers import WarbandSerializer
from apps.warbands.services.summary import load_warband_units

from .constants import PERMISSION_CODES
from .errors import CampaignError, Refused, field_error
from .models import (
    Campaign,
    CampaignBulletinEntry,
    CampaignEncampment,
    CampaignHouseRule,
    CampaignLocation,
    CampaignMembership,
    CampaignMembershipPermission,
    CampaignMessage,
    CampaignSettings,
    PivotalMoment,
)
from .permissions import IMPLICIT_PERMISSION_ROLES, get_membership, has_campaign_permission, is_admin, is_owner
from .serializers import (
    CampaignBulletinEntryCreateSerializer,
    CampaignBulletinEntrySerializer,
    CampaignCreateSerializer,
    CampaignEncampmentSerializer,
    CampaignEncampmentWriteSerializer,
    CampaignHouseRuleCreateSerializer,
    CampaignHouseRuleSerializer,
    CampaignLocationSerializer,
    CampaignLocationWriteSerializer,
    CampaignMemberSerializer,
    CampaignMessageSerializer,
    CampaignPlayerSerializer,
    CampaignSerializer,
    CampaignTopKillerSerializer,
    CampaignUpdateSerializer,
    JoinCampaignSerializer,
    MembershipPermissionsUpdateSerializer,
    MembershipRoleUpdateSerializer,
    PivotalMomentSerializer,
)
from .services import codes, house_rules, removal
from .services.campaigns import create_campaign, regenerate_join_code
from .services.joining import join_campaign
from .services.settings import may_update, update_campaign


def _campaigns_for_user(user):
    return (
        Campaign.objects.select_related("settings")
        .prefetch_related("settings__item_settings")
        .annotate(membership_for_user=FilteredRelation("memberships", condition=Q(memberships__user=user)))
        .filter(membership_for_user__isnull=False)
    )


def _get_campaign_for_user(campaign_id, user):
    membership = get_membership(user, campaign_id)
    if not membership:
        return None

    campaign = (
        _campaigns_for_user(user)
        .filter(id=campaign_id)
        .annotate(
            player_count=Count("memberships", distinct=True),
            role=F("membership_for_user__role__slug"),
        )
    )
    return campaign.first()


def _format_short_date(value):
    if not value:
        return "-"
    if timezone.is_aware(value):
        value = timezone.localtime(value)
    return value.strftime("%d/%m/%y")


def _campaign_feature_enabled(campaign_id, field_name):
    settings_obj = CampaignSettings.objects.only(field_name).filter(campaign_id=campaign_id).first()
    return bool(settings_obj and getattr(settings_obj, field_name, False))


def _battle_history_participant_payload(participant):
    postbattle_json = participant.postbattle_json if isinstance(participant.postbattle_json, dict) else {}
    unit_results = postbattle_json.get("unit_results", {})
    if not isinstance(unit_results, dict) or not unit_results:
        return {
            "warband_id": participant.warband_id,
            "warband_name": participant.warband.name,
            "kills": None,
            "ooas": None,
            "deaths": [],
            "xp_gain": None,
            "exploration": [],
        }

    kills = 0
    ooas = 0
    xp_gain = 0
    deaths = []
    for result in unit_results.values():
        if not isinstance(result, dict):
            continue
        try:
            kills += max(0, int(result.get("kill_count", 0)))
        except (TypeError, ValueError):
            pass
        try:
            xp_gain += max(0, int(result.get("xp_earned", 0)))
        except (TypeError, ValueError):
            pass
        if bool(result.get("out_of_action", False)):
            ooas += 1
        if bool(result.get("dead", False)):
            unit_name = str(result.get("unit_name", "")).strip()
            if unit_name:
                deaths.append(unit_name)

    exploration_raw = postbattle_json.get("exploration", {})
    if not isinstance(exploration_raw, dict):
        exploration_raw = {}
    dice_values_raw = exploration_raw.get("dice_values", [])
    exploration = []
    if isinstance(dice_values_raw, list):
        for entry in dice_values_raw:
            try:
                die_value = int(entry)
            except (TypeError, ValueError):
                continue
            exploration.append(die_value)

    return {
        "warband_id": participant.warband_id,
        "warband_name": participant.warband.name,
        "kills": kills,
        "ooas": ooas,
        "deaths": deaths,
        "xp_gain": xp_gain,
        "exploration": exploration,
    }


def _normalize_unit_type(value):
    cleaned = str(value or "").strip()
    return cleaned or None


def _campaign_top_killers_payload(campaign_id, limit=5):
    empty_value = Value("", output_field=CharField())

    def _annotated_name(name_field, fallback_prefix):
        return Coalesce(
            NullIf(Trim(name_field), empty_value),
            Concat(Value(fallback_prefix), Cast("id", CharField())),
        )

    def _annotated_unit_type(unit_type_field):
        return NullIf(Trim(unit_type_field), empty_value)

    hero_rows = (
        Hero.objects.filter(warband__campaign_id=campaign_id, kills__gt=0)
        .annotate(
            unit_id_value=F("id"),
            unit_kind_value=Value("hero", output_field=CharField()),
            unit_name_value=_annotated_name("name", "Hero "),
            unit_type_value=_annotated_unit_type("unit_type"),
            warband_id_value=F("warband_id"),
            warband_name_value=F("warband__name"),
            kills_value=F("kills"),
            unit_name_sort=Lower(_annotated_name("name", "Hero ")),
            warband_name_sort=Lower("warband__name"),
        )
        .values(
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
    )

    hired_sword_rows = (
        HiredSword.objects.filter(warband__campaign_id=campaign_id, kills__gt=0)
        .annotate(
            unit_id_value=F("id"),
            unit_kind_value=Value("hired_sword", output_field=CharField()),
            unit_name_value=_annotated_name("name", "Hired Sword "),
            unit_type_value=_annotated_unit_type("unit_type"),
            warband_id_value=F("warband_id"),
            warband_name_value=F("warband__name"),
            kills_value=F("kills"),
            unit_name_sort=Lower(_annotated_name("name", "Hired Sword ")),
            warband_name_sort=Lower("warband__name"),
        )
        .values(
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
    )

    henchman_rows = (
        Henchman.objects.filter(group__warband__campaign_id=campaign_id, kills__gt=0)
        .annotate(
            unit_id_value=F("id"),
            unit_kind_value=Value("henchman", output_field=CharField()),
            unit_name_value=_annotated_name("name", "Henchman "),
            unit_type_value=_annotated_unit_type("group__unit_type"),
            warband_id_value=F("group__warband_id"),
            warband_name_value=F("group__warband__name"),
            kills_value=F("kills"),
            unit_name_sort=Lower(_annotated_name("name", "Henchman ")),
            warband_name_sort=Lower("group__warband__name"),
        )
        .values(
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
    )

    rows = list(
        hero_rows.union(hired_sword_rows, henchman_rows, all=True).order_by(
            "-kills_value",
            "unit_name_sort",
            "warband_name_sort",
            "unit_id_value",
        )[:limit]
    )

    return [
        {
            "unit_id": row["unit_id_value"],
            "unit_kind": row["unit_kind_value"],
            "unit_name": row["unit_name_value"],
            "unit_type": _normalize_unit_type(row["unit_type_value"]),
            "warband_id": row["warband_id_value"],
            "warband_name": row["warband_name_value"],
            "kills": row["kills_value"],
        }
        for row in rows
    ]


class CampaignListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        campaigns = (
            _campaigns_for_user(request.user)
            .annotate(
                player_count=Count("memberships", distinct=True),
                role=F("membership_for_user__role__slug"),
            )
            .order_by("name")
        )
        serializer = CampaignSerializer(campaigns, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CampaignCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        campaign = create_campaign(request.user, serializer.validated_data)
        response_serializer = CampaignSerializer(
            _campaigns_for_user(request.user)
            .filter(id=campaign.id)
            .annotate(
                player_count=Count("memberships", distinct=True),
                role=F("membership_for_user__role__slug"),
            )
            .first()
        )
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


def _permission_codes_for(campaign_id, user, role_slug):
    """Permission codes the user holds in the campaign (owners and admins hold all of them)."""
    if role_slug in IMPLICIT_PERMISSION_ROLES:
        return sorted(PERMISSION_CODES)
    return sorted(
        CampaignMembershipPermission.objects.filter(
            membership__campaign_id=campaign_id, membership__user=user
        ).values_list("permission__code", flat=True)
    )


class CampaignJoinCodeView(APIView):
    """POST: owners and admins give the campaign a new join code (decision 1, CAMP-NEW-01). Answers the campaign."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if membership.role.slug not in IMPLICIT_PERMISSION_ROLES:
            return Response({"detail": "Forbidden"}, status=403)
        regenerate_join_code(campaign_id)
        return Response(CampaignSerializer(_get_campaign_for_user(campaign_id, request.user)).data)


class CampaignDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        campaign = _get_campaign_for_user(campaign_id, request.user)
        if not campaign:
            return Response({"detail": "Not found"}, status=404)

        data = CampaignSerializer(campaign).data
        # Pages read the caller's permissions from here instead of each fetching /permissions/me/.
        data["permissions"] = _permission_codes_for(campaign_id, request.user, campaign.role)
        return Response(data)

    def delete(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not is_owner(membership):
            return Response({"detail": "Forbidden"}, status=403)

        campaign = Campaign.objects.filter(id=campaign_id).first()
        if not campaign:
            return Response({"detail": "Not found"}, status=404)

        campaign.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def patch(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not may_update(membership.role.slug, request.data):  # admins may start and unstart only (BUG-13)
            return Response({"detail": "Forbidden"}, status=403)

        campaign = Campaign.objects.select_related("settings").filter(id=campaign_id).first()
        if not campaign:
            return Response({"detail": "Not found"}, status=404)

        serializer = CampaignUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            update_campaign(campaign, serializer.validated_data)
        except (CampaignError, Refused) as refusal:
            return refusal.response()

        refreshed = _get_campaign_for_user(campaign_id, request.user)
        if not refreshed:
            return Response({"detail": "Not found"}, status=404)
        return Response(CampaignSerializer(refreshed).data)


class JoinCampaignView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = JoinCampaignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            campaign = join_campaign(request.user, serializer.validated_data["join_code"])
        except Refused as refusal:
            return refusal.response()

        response_serializer = CampaignSerializer(
            _campaigns_for_user(request.user)
            .filter(id=campaign.id)
            .annotate(
                player_count=Count("memberships", distinct=True),
                role=F("membership_for_user__role__slug"),
            )
            .first()
        )
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


def _busy_battle_fields(busy: tuple | None) -> dict:
    battle_id, battle_status, last_activity_at = busy or (None, None, None)
    return {
        "battle_busy_status": battle_status,
        "battle_busy_battle_id": battle_id,
        "battle_busy_last_activity_at": last_activity_at,
    }


class CampaignPlayersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        memberships = list(
            CampaignMembership.objects.filter(campaign_id=campaign_id)
            .select_related("user")
            .order_by("user__first_name", "user__email")
        )
        if all(member.user_id != request.user.id for member in memberships):  # the member check (PERF-41)
            return Response({"detail": "Not found"}, status=404)
        if request.query_params.get("fields") == "basic":  # name pickers need no warbands (PERF-41)
            return Response([{"id": member.user_id, "name": display_name(member.user)} for member in memberships])
        warbands = list(
            Warband.objects.filter(campaign_id=campaign_id).only("id", "name", "faction", "user_id", "wins", "losses")
        )
        units_by_warband = load_warband_units(warband.id for warband in warbands)
        warband_by_user = {
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
        member_user_ids = [member.user_id for member in memberships]
        busy_entries = (
            busy_participations(campaign_id, member_user_ids)  # the busy rule battles warn with (decision 1)
            .order_by("-battle__created_at")
            .values_list("user_id", "battle_id", "battle__status", "battle__last_activity_at")
        )
        busy_by_user: dict[int, tuple] = {}  # the most recent unfinished battle: id, status, last activity (BUG-10)
        for user_id, *battle in busy_entries:
            busy_by_user.setdefault(user_id, tuple(battle))
        players = [
            {
                "id": member.user_id,
                "name": display_name(member.user),
                "warband": warband_by_user.get(member.user_id),
                "battle_busy": member.user_id in busy_by_user,
                **_busy_battle_fields(busy_by_user.get(member.user_id)),
            }
            for member in memberships
        ]
        serializer = CampaignPlayerSerializer(players, many=True)
        return Response(serializer.data)


HISTORY_UNREAD_FIELDS = (
    "selected_unit_keys_json",
    "unit_information_json",
    "custom_units_json",
    "roster_json",
    "battle_notes",
)


class CampaignBattleHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        battles = list(
            Battle.objects.filter(
                campaign_id=campaign_id,
                status=Battle.STATUS_ENDED,
            )
            .prefetch_related(
                Prefetch(  # without those a battle manager took off the record (BATL-NEW-04)
                    "participants",
                    queryset=BattleParticipant.objects.select_related("warband")
                    .filter(removed_from_record=False)
                    .defer(*HISTORY_UNREAD_FIELDS)  # only postbattle_json is read (PERF-45)
                    .order_by("id"),
                )
            )
            .order_by("-ended_at", "-created_at", "-id")
        )

        payload = []
        for battle in battles:
            participants = list(battle.participants.all())
            winner_ids = set(battle.winner_warband_ids_json or [])
            winner_names = [
                participant.warband.name for participant in participants if participant.warband_id in winner_ids
            ]
            payload.append(
                {
                    "id": battle.id,
                    "scenario": battle.scenario,
                    "winners": winner_names,
                    "date": _format_short_date(battle.ended_at or battle.created_at),
                    "participants": [_battle_history_participant_payload(participant) for participant in participants],
                }
            )

        return Response(payload)


class CampaignActiveBattlesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_battles"):
            return Response({"detail": "Forbidden"}, status=403)

        battles = (
            Battle.objects.filter(
                campaign_id=campaign_id,
                status__in=(
                    Battle.STATUS_INVITING,
                    Battle.STATUS_REPORTED_RESULT_PENDING,
                    Battle.STATUS_PREBATTLE,
                    Battle.STATUS_ACTIVE,
                    Battle.STATUS_POSTBATTLE,
                ),
            )
            .prefetch_related(
                Prefetch(
                    "participants",
                    queryset=BattleParticipant.objects.select_related("user", "warband").order_by("id"),
                )
            )
            .order_by("-created_at", "-id")
        )
        if expire_overdue(battles):  # settle what is past its deadline (decision 2), then read again
            battles = battles.all()

        payload = []
        for battle in battles:
            participants = battle.participants.all()
            payload.append(
                {
                    "battle": serialize_battle(battle),  # its last_activity_at is the idle time
                    "participants": [serialize_participant(participant) for participant in participants],
                    "actions": manager_actions(battle, participants),  # the owner tools that apply (BATL-NEW-03)
                }
            )

        return Response(payload)


class CampaignActiveBattleCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_battles"):
            return Response({"detail": "Forbidden"}, status=403)

        events: list[dict] = []
        with transaction.atomic():
            battle = Battle.objects.select_for_update().filter(id=battle_id, campaign_id=campaign_id).first()
            if not battle:
                return Response({"detail": "Not found"}, status=404)
            if battle.status == Battle.STATUS_CANCELED:
                return response_with_snapshot(battle.id, events)
            if battle.status == Battle.STATUS_ENDED:
                return Response({"detail": "Battle is already ended"}, status=400)
            if battle.status == Battle.STATUS_POSTBATTLE:  # decision 3, BUG-09
                return Response(
                    {"detail": "Postbattle can't be cancelled; close it instead", "code": "use_close_postbattle"},
                    status=400,
                )
            if battle.status == Battle.STATUS_ACTIVE and someone_finalised(battle.id):  # decision 4, BUG-09
                return Response({"detail": POSTBATTLE_APPLIED, "code": "postbattle_applied"}, status=400)

            event = cancel_battle(
                battle,
                actor_user=request.user,
                mode="campaign_owner" if is_owner(membership) else "campaign_manager",
            )
            events.append(event)
            version = bump_state_version(battle)

        return broadcast_response(request, battle.id, events, version, changed=ALL)


class CampaignPivotalMomentsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        moments = (
            PivotalMoment.objects.filter(campaign_id=campaign_id)
            .select_related("battle", "warband")
            .order_by("-battle_ended_at", "id")
        )
        serializer = PivotalMomentSerializer(moments, many=True)
        payload = []
        for moment, row in zip(moments, serializer.data, strict=True):
            payload.append(
                {
                    **row,
                    "date": _format_short_date(moment.battle_ended_at),
                }
            )
        return Response(payload)


class CampaignTopKillersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        top_killers = _campaign_top_killers_payload(campaign_id)
        serializer = CampaignTopKillerSerializer(top_killers, many=True)
        return Response({"top_killers": serializer.data})


class CampaignBulletinView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        entries = CampaignBulletinEntry.objects.filter(campaign_id=campaign_id).select_related("user")
        serializer = CampaignBulletinEntrySerializer(entries, many=True)
        return Response(serializer.data)

    def post(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        serializer = CampaignBulletinEntryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        username = display_name(user)  # SEC-13: never the email
        entry = CampaignBulletinEntry.objects.create(
            campaign_id=campaign_id,
            user=user,
            username=username,
            body=serializer.validated_data["body"],
        )
        response_serializer = CampaignBulletinEntrySerializer(entry)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class CampaignBulletinDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, campaign_id, entry_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        entry = CampaignBulletinEntry.objects.filter(id=entry_id, campaign_id=campaign_id).first()
        if not entry:
            return Response({"detail": "Not found"}, status=404)
        if entry.user_id != request.user.id:
            return Response({"detail": "Forbidden"}, status=403)

        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CampaignEncampmentsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not _campaign_feature_enabled(campaign_id, "enable_encampments"):
            return Response({"detail": "Not found"}, status=404)

        entries = CampaignEncampment.objects.filter(campaign_id=campaign_id).select_related("owner")
        serializer = CampaignEncampmentSerializer(entries, many=True)
        return Response(serializer.data)

    def post(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not _campaign_feature_enabled(campaign_id, "enable_encampments"):
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_encampments"):
            return Response({"detail": "Forbidden"}, status=403)

        serializer = CampaignEncampmentWriteSerializer(
            data=request.data,
            context={"campaign_id": campaign_id},
        )
        serializer.is_valid(raise_exception=True)
        entry = serializer.save(campaign_id=campaign_id)
        response_serializer = CampaignEncampmentSerializer(entry)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class CampaignEncampmentDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, campaign_id, encampment_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not _campaign_feature_enabled(campaign_id, "enable_encampments"):
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_encampments"):
            return Response({"detail": "Forbidden"}, status=403)

        entry = (
            CampaignEncampment.objects.filter(id=encampment_id, campaign_id=campaign_id).select_related("owner").first()
        )
        if not entry:
            return Response({"detail": "Not found"}, status=404)

        serializer = CampaignEncampmentWriteSerializer(
            entry,
            data=request.data,
            partial=True,
            context={"campaign_id": campaign_id},
        )
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(CampaignEncampmentSerializer(updated).data)


class CampaignLocationsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not _campaign_feature_enabled(campaign_id, "enable_locations"):
            return Response({"detail": "Not found"}, status=404)

        entries = CampaignLocation.objects.filter(campaign_id=campaign_id)
        serializer = CampaignLocationSerializer(entries, many=True)
        return Response(serializer.data)

    def post(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not _campaign_feature_enabled(campaign_id, "enable_locations"):
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_locations"):
            return Response({"detail": "Forbidden"}, status=403)

        serializer = CampaignLocationWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = serializer.save(campaign_id=campaign_id)
        response_serializer = CampaignLocationSerializer(entry)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class CampaignLocationDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, campaign_id, location_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not _campaign_feature_enabled(campaign_id, "enable_locations"):
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_locations"):
            return Response({"detail": "Forbidden"}, status=403)

        entry = CampaignLocation.objects.filter(id=location_id, campaign_id=campaign_id).first()
        if not entry:
            return Response({"detail": "Not found"}, status=404)

        serializer = CampaignLocationWriteSerializer(entry, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(CampaignLocationSerializer(updated).data)


class CampaignWarbandsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        warbands = (
            Warband.objects.filter(campaign_id=campaign_id)
            .select_related("campaign", "campaign__settings")
            .prefetch_related("campaign__settings__item_settings")
            .order_by("name")
        )
        serializer = WarbandSerializer(warbands, many=True)
        return Response(serializer.data)


class CampaignMembersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not (is_owner(membership) or is_admin(membership)):
            return Response({"detail": "Forbidden"}, status=403)

        memberships = (
            CampaignMembership.objects.filter(campaign_id=campaign_id)
            .select_related("user", "role")
            .prefetch_related(
                Prefetch(
                    "permissions",
                    queryset=CampaignMembershipPermission.objects.select_related("permission"),
                )
            )
            .order_by("role__slug", "user__first_name", "user__email")
        )
        warband_map = {
            w.user_id: w for w in Warband.objects.filter(campaign_id=campaign_id).only("id", "name", "user_id")
        }
        members = [
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
        serializer = CampaignMemberSerializer(members, many=True)
        return Response(serializer.data)


class CampaignPermissionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        return Response(codes.describe())


class CampaignMyPermissionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        if membership.role.slug in IMPLICIT_PERMISSION_ROLES:
            return Response(codes.describe())
        held = CampaignMembershipPermission.objects.filter(membership=membership).values_list(
            "permission__code", flat=True
        )
        return Response(codes.describe(codes.in_catalogue_order(held)))


class CampaignMemberPermissionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, campaign_id, user_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not (is_owner(membership) or is_admin(membership)):
            return Response({"detail": "Forbidden"}, status=403)

        target_membership = (
            CampaignMembership.objects.select_related("role").filter(campaign_id=campaign_id, user_id=user_id).first()
        )
        if not target_membership:
            return Response({"detail": "Not found"}, status=404)
        if target_membership.role.slug in ("owner", "admin"):
            return Response(
                {"detail": "Permissions are managed automatically for admins and owners."},
                status=400,
            )

        serializer = MembershipPermissionsUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        requested = serializer.validated_data["permissions"]
        unknown = [code for code in requested if code not in PERMISSION_CODES]
        if unknown:  # refused, never dropped (BUG-15)
            return field_error(
                "permissions", f"Unknown permission: {', '.join(unknown)}.", "unknown_permission"
            ).response()
        codes.replace_grants(target_membership, requested)
        return Response(codes.describe(requested))


class CampaignMemberRoleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, campaign_id, user_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not is_owner(membership):
            return Response({"detail": "Forbidden"}, status=403)

        target_membership = (
            CampaignMembership.objects.select_related("role").filter(campaign_id=campaign_id, user_id=user_id).first()
        )
        if not target_membership:
            return Response({"detail": "Not found"}, status=404)
        if target_membership.role.slug == "owner":
            return Response({"detail": "Owner role cannot be changed."}, status=400)

        serializer = MembershipRoleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        requested_role = serializer.validated_data["role"]

        CampaignMembership.objects.filter(id=target_membership.id).update(role_id=codes.role_ref(requested_role))
        return Response({"id": target_membership.user_id, "role": requested_role})


class CampaignMemberRemoveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, campaign_id, user_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        try:  # closes his battles and trades; his warband stays (decision 1, BUG-12, BUG-50)
            removal.remove_member(membership, user_id, request.user)
        except Refused as refusal:
            return refusal.response()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CampaignMemberRemovalPreviewView(APIView):
    """GET: what removing the member will close, for the Remove dialog (decision 1)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id, user_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        try:
            return Response(removal.preview(membership, user_id))
        except Refused as refusal:
            return refusal.response()


class CampaignHouseRulesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        rules = CampaignHouseRule.objects.filter(campaign_id=campaign_id).order_by("created_at")
        serializer = CampaignHouseRuleSerializer(rules, many=True)
        return Response(serializer.data)

    def post(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_rules"):
            return Response({"detail": "Forbidden"}, status=403)

        serializer = CampaignHouseRuleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rule, created = house_rules.create_rule(campaign_id, serializer.validated_data)  # one per effect (BUG-52)
        answer_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(CampaignHouseRuleSerializer(rule).data, status=answer_status)


class CampaignHouseRuleDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, campaign_id, rule_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_rules"):
            return Response({"detail": "Forbidden"}, status=403)

        rule = CampaignHouseRule.objects.filter(id=rule_id, campaign_id=campaign_id).first()
        if not rule:
            return Response({"detail": "Not found"}, status=404)

        serializer = CampaignHouseRuleCreateSerializer(rule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:  # the clones change only with the effect (PERF-44)
            rule = house_rules.update_rule(rule, serializer.validated_data)
        except Refused as refusal:
            return refusal.response()
        return Response(CampaignHouseRuleSerializer(rule).data)

    def delete(self, request, campaign_id, rule_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_rules"):
            return Response({"detail": "Forbidden"}, status=403)

        rule = CampaignHouseRule.objects.filter(id=rule_id, campaign_id=campaign_id).first()
        if not rule:
            return Response({"detail": "Not found"}, status=404)

        effect_key = rule.effect_key
        with transaction.atomic():
            rule.delete()
            house_rules.revert_effect_if_unused(campaign_id, effect_key)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CampaignPingView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = CAMPAIGN_PING_THROTTLE_CLASSES

    def post(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        payload = request.data.get("payload")
        if not send_campaign_ping(campaign_id, request.user, payload):
            return Response(
                {"detail": "Realtime not configured"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({"status": "ok"}, status=status.HTTP_200_OK)


class CampaignMessagesView(MethodScopedThrottleMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = CAMPAIGN_CHAT_THROTTLE_CLASSES

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        before_id = request.query_params.get("before")
        qs = CampaignMessage.objects.filter(campaign_id=campaign_id).select_related("user")
        if before_id:
            try:
                qs = qs.filter(id__lt=int(before_id))
            except (ValueError, TypeError):
                pass

        messages = qs.order_by("-id")[:50]  # the order pages are cut in, on Index(campaign, -id) (PERF-45)
        serializer = CampaignMessageSerializer(messages, many=True)
        return Response(serializer.data)

    def post(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        raw_body = request.data.get("body", "")
        if not isinstance(raw_body, str):  # BUG-129: a list or object used to be stored as its Python repr
            return field_error("body", "Message body must be text.").response()
        body = raw_body.strip()
        if not body:
            return Response({"detail": "Message body is required."}, status=400)
        if len(body) > 2000:
            return Response({"detail": "Message is too long."}, status=400)

        user = request.user
        username = display_name(user)  # SEC-13: never the email
        message = CampaignMessage.objects.create(
            campaign_id=campaign_id,
            user=user,
            username=username,
            body=body,
        )
        send_campaign_chat_message(campaign_id, message)
        serializer = CampaignMessageSerializer(message)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
