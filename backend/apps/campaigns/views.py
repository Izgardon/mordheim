import random
import string
from functools import lru_cache

from django.db import transaction
from django.db.models import Count, F, FilteredRelation, Prefetch, Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.realtime.services import send_campaign_chat_message, send_campaign_ping
from apps.items.services import (
    HALF_PRICE_ARMOUR_EFFECT_KEY,
    IMPROVED_SHIELDS_EFFECT_KEY,
    revert_half_price_armour_for_campaign,
    revert_improved_shields_for_campaign,
    sync_half_price_armour_for_campaign,
    sync_improved_shields_for_campaign,
)
from apps.warbands.models import Henchman, Hero, HiredSword, Warband
from apps.warbands.serializers import WarbandSerializer, WarbandSummarySerializer
from apps.warbands.utils.trades import TradeHelper
from apps.battles.models import Battle, BattleParticipant
from apps.battles.views.shared import (
    _cancel_battle_for_all_participants,
    _response_with_snapshot,
    _serialize_battle,
    _serialize_participant,
)

from .models import (
    Campaign,
    CampaignHouseRule,
    CampaignMembership,
    CampaignMembershipPermission,
    CampaignMessage,
    CampaignPermission,
    PivotalMoment,
    CampaignRole,
    CampaignSettings,
)
from apps.warbands.restrictions import get_valid_campaign_item_settings
from .permissions import get_membership, has_campaign_permission, is_admin, is_owner
from .serializers import (
    CampaignCreateSerializer,
    CampaignHouseRuleCreateSerializer,
    CampaignHouseRuleSerializer,
    CampaignMemberSerializer,
    CampaignMessageSerializer,
    CampaignPermissionSerializer,
    CampaignPlayerSerializer,
    CampaignSerializer,
    CampaignTopKillerSerializer,
    CampaignUpdateSerializer,
    JoinCampaignSerializer,
    MembershipPermissionsUpdateSerializer,
    MembershipRoleUpdateSerializer,
    PivotalMomentSerializer,
)

ROLE_SEED = [
    ("owner", "Owner"),
    ("admin", "Admin"),
    ("player", "Player"),
]

PERMISSION_SEED = [
    ("add_custom", "Add custom"),
    ("manage_items", "Manage items"),
    ("manage_skills", "Manage skills"),
    ("manage_rules", "Manage rules"),
    ("manage_warbands", "Manage warbands"),
    ("manage_locations", "Manage locations"),
    ("manage_bestiary", "Manage bestiary"),
]


@lru_cache(maxsize=1)
def _ensure_roles():
    """
    Ensure roles exist and return cached mapping of slug -> role.
    Uses LRU cache to avoid repeated database queries within the same process.
    """
    roles = {}
    for slug, name in ROLE_SEED:
        role, _ = CampaignRole.objects.get_or_create(slug=slug, defaults={"name": name})
        roles[slug] = role
    return roles


@lru_cache(maxsize=1)
def _ensure_permissions():
    """
    Ensure permissions exist and return cached mapping of code -> permission.
    Uses LRU cache to avoid repeated database queries within the same process.
    """
    permissions = {}
    for code, name in PERMISSION_SEED:
        permission, _ = CampaignPermission.objects.get_or_create(code=code, defaults={"name": name})
        permissions[code] = permission
    return permissions


def _generate_join_code():
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choice(alphabet) for _ in range(6))


def _unique_join_code():
    for _ in range(20):
        code = _generate_join_code()
        if not Campaign.objects.filter(join_code=code).exists():
            return code
    return _generate_join_code()


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
    top_killers = []

    for hero in (
        Hero.objects.filter(warband__campaign_id=campaign_id, kills__gt=0)
        .select_related("warband")
        .only("id", "name", "unit_type", "kills", "warband__id", "warband__name")
    ):
        top_killers.append(
            {
                "unit_id": hero.id,
                "unit_kind": "hero",
                "unit_name": hero.name or f"Hero {hero.id}",
                "unit_type": _normalize_unit_type(hero.unit_type),
                "warband_id": hero.warband_id,
                "warband_name": hero.warband.name,
                "kills": hero.kills,
            }
        )

    for hired_sword in (
        HiredSword.objects.filter(warband__campaign_id=campaign_id, kills__gt=0)
        .select_related("warband")
        .only("id", "name", "unit_type", "kills", "warband__id", "warband__name")
    ):
        top_killers.append(
            {
                "unit_id": hired_sword.id,
                "unit_kind": "hired_sword",
                "unit_name": hired_sword.name or f"Hired Sword {hired_sword.id}",
                "unit_type": _normalize_unit_type(hired_sword.unit_type),
                "warband_id": hired_sword.warband_id,
                "warband_name": hired_sword.warband.name,
                "kills": hired_sword.kills,
            }
        )

    for henchman in (
        Henchman.objects.filter(group__warband__campaign_id=campaign_id, kills__gt=0)
        .select_related("group__warband")
        .only(
            "id",
            "name",
            "kills",
            "group__unit_type",
            "group__warband__id",
            "group__warband__name",
        )
    ):
        top_killers.append(
            {
                "unit_id": henchman.id,
                "unit_kind": "henchman",
                "unit_name": henchman.name or f"Henchman {henchman.id}",
                "unit_type": _normalize_unit_type(henchman.group.unit_type),
                "warband_id": henchman.group.warband_id,
                "warband_name": henchman.group.warband.name,
                "kills": henchman.kills,
            }
        )

    top_killers.sort(
        key=lambda entry: (
            -entry["kills"],
            entry["unit_name"].lower(),
            entry["warband_name"].lower(),
            entry["unit_id"],
        )
    )
    return top_killers[:limit]


def _sync_house_rule_effect(campaign_id, effect_key):
    if effect_key == HALF_PRICE_ARMOUR_EFFECT_KEY:
        sync_half_price_armour_for_campaign(campaign_id)
    elif effect_key == IMPROVED_SHIELDS_EFFECT_KEY:
        sync_improved_shields_for_campaign(campaign_id)


def _revert_house_rule_effect_if_unused(campaign_id, effect_key):
    if effect_key not in (HALF_PRICE_ARMOUR_EFFECT_KEY, IMPROVED_SHIELDS_EFFECT_KEY):
        return
    if CampaignHouseRule.objects.filter(campaign_id=campaign_id, effect_key=effect_key).exists():
        return
    if effect_key == HALF_PRICE_ARMOUR_EFFECT_KEY:
        revert_half_price_armour_for_campaign(campaign_id)
    elif effect_key == IMPROVED_SHIELDS_EFFECT_KEY:
        revert_improved_shields_for_campaign(campaign_id)


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

        roles = _ensure_roles()
        validated = serializer.validated_data
        item_setting_ids = validated.get("item_setting_ids", [])

        campaign = Campaign.objects.create(
            name=validated["name"],
            join_code=_unique_join_code(),
        )

        settings = CampaignSettings.objects.create(
            campaign=campaign,
            max_players=validated.get("max_players", 8),
            max_heroes=validated.get("max_heroes", 6),
            max_hired_swords=validated.get("max_hired_swords", 3),
            max_games=validated.get("max_games", 10),
            starting_gold=validated.get("starting_gold", 500),
        )
        if item_setting_ids:
            settings.item_settings.set(get_valid_campaign_item_settings(item_setting_ids))

        CampaignMembership.objects.create(
            campaign=campaign,
            user=request.user,
            role=roles["owner"],
        )

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


class CampaignDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        campaign = _get_campaign_for_user(campaign_id, request.user)
        if not campaign:
            return Response({"detail": "Not found"}, status=404)

        serializer = CampaignSerializer(campaign)
        return Response(serializer.data)

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
        if not is_owner(membership):
            return Response({"detail": "Forbidden"}, status=403)

        campaign = Campaign.objects.select_related("settings").filter(id=campaign_id).first()
        if not campaign:
            return Response({"detail": "Not found"}, status=404)

        serializer = CampaignUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        campaign_updates = {}
        settings_updates = {}
        item_setting_ids = serializer.validated_data.get("item_setting_ids")

        if "in_progress" in serializer.validated_data:
            campaign_updates["in_progress"] = serializer.validated_data["in_progress"]
        if "max_heroes" in serializer.validated_data:
            settings_updates["max_heroes"] = serializer.validated_data["max_heroes"]
        if "max_hired_swords" in serializer.validated_data:
            settings_updates["max_hired_swords"] = serializer.validated_data["max_hired_swords"]
        if "starting_gold" in serializer.validated_data:
            settings_updates["starting_gold"] = serializer.validated_data["starting_gold"]
        if "hero_death_roll" in serializer.validated_data:
            settings_updates["hero_death_roll"] = serializer.validated_data["hero_death_roll"]
        if "hero_level_thresholds" in serializer.validated_data:
            settings_updates["hero_level_thresholds"] = serializer.validated_data["hero_level_thresholds"]
        if "henchmen_level_thresholds" in serializer.validated_data:
            settings_updates["henchmen_level_thresholds"] = serializer.validated_data["henchmen_level_thresholds"]
        if "hired_sword_level_thresholds" in serializer.validated_data:
            settings_updates["hired_sword_level_thresholds"] = serializer.validated_data["hired_sword_level_thresholds"]

        if not campaign_updates and not settings_updates and item_setting_ids is None:
            return Response({"detail": "No updates provided."}, status=400)

        if campaign_updates:
            for field, value in campaign_updates.items():
                setattr(campaign, field, value)
            campaign.save(update_fields=list(campaign_updates.keys()))

        if settings_updates or item_setting_ids is not None:
            settings, _ = CampaignSettings.objects.get_or_create(campaign=campaign)
            for field, value in settings_updates.items():
                setattr(settings, field, value)
            if settings_updates:
                settings.save(update_fields=list(settings_updates.keys()))
            if item_setting_ids is not None:
                settings.item_settings.set(get_valid_campaign_item_settings(item_setting_ids))
            if "starting_gold" in settings_updates:
                for warband in Warband.objects.filter(campaign=campaign):
                    TradeHelper.upsert_starting_gold_trade(warband, settings_updates["starting_gold"])

        refreshed = _get_campaign_for_user(campaign_id, request.user)
        if not refreshed:
            return Response({"detail": "Not found"}, status=404)
        return Response(CampaignSerializer(refreshed).data)


class JoinCampaignView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = JoinCampaignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        join_code = serializer.validated_data["join_code"]

        campaign = Campaign.objects.select_related("settings").filter(join_code=join_code).first()
        if not campaign:
            return Response({"detail": "Campaign not found"}, status=404)

        if CampaignMembership.objects.filter(campaign=campaign, user=request.user).exists():
            return Response({"detail": "Already a member"}, status=400)

        player_count = CampaignMembership.objects.filter(campaign=campaign).count()
        max_players = campaign.max_players
        if player_count >= max_players:
            return Response({"detail": "Campaign is full"}, status=400)

        roles = _ensure_roles()
        permissions = _ensure_permissions()
        membership = CampaignMembership.objects.create(campaign=campaign, user=request.user, role=roles["player"])

        default_permissions = [
            permissions.get("add_custom"),
        ]
        CampaignMembershipPermission.objects.bulk_create(
            [
                CampaignMembershipPermission(
                    membership=membership,
                    permission=permission,
                )
                for permission in default_permissions
                if permission is not None
            ],
            ignore_conflicts=True,
        )

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


class CampaignPlayersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        memberships = (
            CampaignMembership.objects.filter(campaign_id=campaign_id)
            .select_related("user")
            .order_by("user__first_name", "user__email")
        )
        warbands = Warband.objects.filter(campaign_id=campaign_id).only(
            "id", "name", "faction", "user_id", "wins", "losses"
        )
        warband_rating_serializer = WarbandSummarySerializer()
        warband_by_user = {
            warband.user_id: {
                "id": warband.id,
                "name": warband.name,
                "faction": warband.faction,
                "wins": warband.wins,
                "losses": warband.losses,
                "rating": warband_rating_serializer.get_rating(warband),
            }
            for warband in warbands
        }
        member_user_ids = [member.user_id for member in memberships]
        busy_entries = (
            BattleParticipant.objects.filter(
                user_id__in=member_user_ids,
                battle__campaign_id=campaign_id,
                battle__flow_type=Battle.FLOW_TYPE_NORMAL,
                battle__status__in=(
                    Battle.STATUS_INVITING,
                    Battle.STATUS_PREBATTLE,
                    Battle.STATUS_ACTIVE,
                    Battle.STATUS_POSTBATTLE,
                ),
                status__in=(
                    BattleParticipant.STATUS_INVITED,
                    BattleParticipant.STATUS_ACCEPTED,
                    BattleParticipant.STATUS_JOINED_PREBATTLE,
                    BattleParticipant.STATUS_READY,
                    BattleParticipant.STATUS_IN_BATTLE,
                    BattleParticipant.STATUS_FINISHED_BATTLE,
                ),
            )
            .select_related("battle")
            .order_by("-battle__created_at")
        )
        busy_status_by_user = {}
        for entry in busy_entries:
            busy_status_by_user.setdefault(entry.user_id, entry.battle.status)
        players = [
            {
                "id": member.user_id,
                "name": member.user.first_name or member.user.email,
                "warband": warband_by_user.get(member.user_id),
                "battle_busy": member.user_id in busy_status_by_user,
                "battle_busy_status": busy_status_by_user.get(member.user_id),
            }
            for member in memberships
        ]
        serializer = CampaignPlayerSerializer(players, many=True)
        return Response(serializer.data)


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
                Prefetch(
                    "participants",
                    queryset=BattleParticipant.objects.select_related("warband").order_by("id"),
                )
            )
            .order_by("-ended_at", "-created_at", "-id")
        )

        payload = []
        for battle in battles:
            participants = list(battle.participants.all())
            winner_ids = set(battle.winner_warband_ids_json or [])
            winner_names = [participant.warband.name for participant in participants if participant.warband_id in winner_ids]
            payload.append(
                {
                    "id": battle.id,
                    "scenario": battle.scenario,
                    "winners": winner_names,
                    "date": _format_short_date(battle.ended_at or battle.created_at),
                    "participants": [
                        _battle_history_participant_payload(participant) for participant in participants
                    ],
                }
            )

        return Response(payload)


class CampaignActiveBattlesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not is_owner(membership):
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

        payload = []
        for battle in battles:
            payload.append(
                {
                    "battle": _serialize_battle(battle),
                    "participants": [
                        _serialize_participant(participant) for participant in battle.participants.all()
                    ],
                }
            )

        return Response(payload)


class CampaignActiveBattleCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id, battle_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not is_owner(membership):
            return Response({"detail": "Forbidden"}, status=403)

        events: list[dict] = []
        with transaction.atomic():
            battle = Battle.objects.select_for_update().filter(id=battle_id, campaign_id=campaign_id).first()
            if not battle:
                return Response({"detail": "Not found"}, status=404)
            if battle.status == Battle.STATUS_CANCELED:
                return _response_with_snapshot(battle.id, events)
            if battle.status == Battle.STATUS_ENDED:
                return Response({"detail": "Battle is already ended"}, status=400)

            event = _cancel_battle_for_all_participants(
                battle,
                actor_user=request.user,
                mode="campaign_owner",
            )
            events.append(event)

        return _response_with_snapshot(battle.id, events)


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
        for moment, row in zip(moments, serializer.data):
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


class CampaignWarbandsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        warbands = (
            Warband.objects.filter(campaign_id=campaign_id)
            .select_related("campaign", "campaign__settings")
            .prefetch_related("restrictions", "campaign__settings__item_settings")
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

        _ensure_permissions()
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
                "name": member.user.first_name or member.user.email,
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

        permissions = _ensure_permissions()
        permission_by_code = {
            permission.code: permission for permission in CampaignPermission.objects.filter(code__in=permissions.keys())
        }
        ordered_permissions = [permission_by_code[code] for code in permissions.keys() if code in permission_by_code]
        serializer = CampaignPermissionSerializer(ordered_permissions, many=True)
        return Response(serializer.data)


class CampaignMyPermissionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        permissions = _ensure_permissions()
        if membership.role.slug in ("owner", "admin"):
            permission_objects = [permissions[code] for code in permissions.keys() if code in permissions]
        else:
            permission_objects = [
                entry.permission
                for entry in CampaignMembershipPermission.objects.filter(membership=membership).select_related(
                    "permission"
                )
            ]

        serializer = CampaignPermissionSerializer(permission_objects, many=True)
        return Response(serializer.data)


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

        permissions = _ensure_permissions()
        allowed_permissions = [permissions[code] for code in requested if code in permissions]

        CampaignMembershipPermission.objects.filter(membership=target_membership).delete()
        CampaignMembershipPermission.objects.bulk_create(
            [
                CampaignMembershipPermission(membership=target_membership, permission=permission)
                for permission in allowed_permissions
            ]
        )

        response_serializer = CampaignPermissionSerializer(allowed_permissions, many=True)
        return Response(response_serializer.data)


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

        roles = _ensure_roles()
        target_membership.role = roles[requested_role]
        target_membership.save(update_fields=["role"])

        return Response({"id": target_membership.user_id, "role": target_membership.role.slug})


class CampaignMemberRemoveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, campaign_id, user_id):
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
        if target_membership.role.slug != "player":
            return Response({"detail": "Only players can be removed."}, status=400)

        target_membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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
        with transaction.atomic():
            rule = serializer.save(campaign_id=campaign_id)
            _sync_house_rule_effect(campaign_id, rule.effect_key)
        return Response(CampaignHouseRuleSerializer(rule).data, status=status.HTTP_201_CREATED)


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

        previous_effect_key = rule.effect_key
        serializer = CampaignHouseRuleCreateSerializer(rule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            rule = serializer.save()
            _revert_house_rule_effect_if_unused(campaign_id, previous_effect_key)
            _sync_house_rule_effect(campaign_id, rule.effect_key)
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
            _revert_house_rule_effect_if_unused(campaign_id, effect_key)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CampaignPingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

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


class CampaignMessagesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

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

        messages = qs.order_by("-created_at")[:50]
        serializer = CampaignMessageSerializer(messages, many=True)
        return Response(serializer.data)

    def post(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        body = str(request.data.get("body", "")).strip()
        if not body:
            return Response({"detail": "Message body is required."}, status=400)
        if len(body) > 2000:
            return Response({"detail": "Message is too long."}, status=400)

        user = request.user
        username = user.first_name or user.get_username()
        message = CampaignMessage.objects.create(
            campaign_id=campaign_id,
            user=user,
            username=username,
            body=body,
        )
        send_campaign_chat_message(campaign_id, message)
        serializer = CampaignMessageSerializer(message)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
