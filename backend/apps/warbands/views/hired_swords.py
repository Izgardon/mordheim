from django.db import transaction
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.models import CampaignSettings
from apps.logs.utils import log_warband_event
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell
from apps.warbands.models import (
    HiredSword,
    HiredSwordSkill,
    HiredSwordSpecial,
    HiredSwordSpell,
)
from apps.warbands.permissions import CanEditWarband, CanViewWarband
from apps.warbands.prefetches import (
    HIRED_SWORD_DETAIL_PREFETCH,
    HIRED_SWORD_SUMMARY_PREFETCH,
    hired_sword_detail_queryset,
)
from apps.warbands.serializers import (
    HiredSwordCreateSerializer,
    HiredSwordDetailSerializer,
    HiredSwordLevelUpLogSerializer,
    HiredSwordSummarySerializer,
    HiredSwordUpdateSerializer,
)
from apps.warbands.services.level_up import (
    PLACEHOLDER_ADVANCES,
    advance_record,
    pending_placeholder,
    spend_level_up,
)
from apps.warbands.units.services.loadout import linked_ids
from apps.warbands.utils.trades import TradeHelper

from .mixins import WarbandObjectMixin


class WarbandHiredSwordListCreateView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        hired_swords = (
            HiredSword.objects.filter(warband=warband, dead=False)
            .select_related("race")
            .prefetch_related(
                *HIRED_SWORD_SUMMARY_PREFETCH,
            )
            .order_by("id")
        )
        serializer = HiredSwordSummarySerializer(hired_swords, many=True)
        return Response(serializer.data)

    def post(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        serializer = HiredSwordCreateSerializer(data=request.data, context={"campaign_id": warband.campaign_id})
        serializer.is_valid(raise_exception=True)
        campaign_settings = CampaignSettings.objects.filter(campaign=warband.campaign).first()
        max_hired = campaign_settings.max_hired_swords if campaign_settings else 3
        if max_hired is None:
            max_hired = 3

        is_blood_pacted = bool(serializer.validated_data.get("blood_pacted", False))
        active_hired_sword_count = HiredSword.objects.filter(
            warband=warband,
            blood_pacted=False,
            dead=False,
        ).count()
        if not is_blood_pacted and active_hired_sword_count >= max_hired:
            return Response({"detail": f"Warband already has {max_hired} hired swords"}, status=400)

        with transaction.atomic():
            hired_sword = serializer.save(warband=warband)
            log_warband_event(
                warband.id,
                "personnel",
                "new_hired_sword",
                {"name": hired_sword.name or "Unknown", "type": hired_sword.unit_type or "Unknown"},
            )
            if hired_sword.price and hired_sword.price > 0:
                name = hired_sword.name or "Unknown"
                unit_type = hired_sword.unit_type or "Unknown"
                TradeHelper.create_trade(
                    warband=warband,
                    action="Hired",
                    description=f"{name} the {unit_type}",
                    price=hired_sword.price,
                    notes="",
                )

        return Response(HiredSwordDetailSerializer(hired_sword).data, status=status.HTTP_201_CREATED)


class WarbandHiredSwordDetailListView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        hired_swords = (
            HiredSword.objects.filter(warband=warband, dead=False)
            .select_related("race")
            .prefetch_related(
                *HIRED_SWORD_DETAIL_PREFETCH,
            )
            .order_by("id")
        )
        return Response(HiredSwordDetailSerializer(hired_swords, many=True).data)


class WarbandHiredSwordDetailView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id, hired_sword_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        hired_sword = (
            HiredSword.objects.filter(id=hired_sword_id, warband=warband, dead=False)
            .select_related("race")
            .prefetch_related(
                *HIRED_SWORD_DETAIL_PREFETCH,
            )
            .first()
        )
        if not hired_sword:
            return Response({"detail": "Not found"}, status=404)

        return Response(HiredSwordDetailSerializer(hired_sword).data)

    def patch(self, request, warband_id, hired_sword_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        hired_sword = (
            HiredSword.objects.filter(id=hired_sword_id, warband=warband, dead=False)
            .select_related("warband__campaign__settings")
            .first()
        )
        if not hired_sword:
            return Response({"detail": "Not found"}, status=404)

        # Read only the loadout lists this write replaces, to log what it adds.
        old_skill_ids = linked_ids(hired_sword.hired_sword_skills, "skill_id") if "skill_ids" in request.data else set()
        old_special_ids = (
            linked_ids(hired_sword.hired_sword_specials, "special_id") if "special_ids" in request.data else set()
        )
        old_spell_ids = linked_ids(hired_sword.hired_sword_spells, "spell_id") if "spell_ids" in request.data else set()

        serializer = HiredSwordUpdateSerializer(
            hired_sword, data=request.data, partial=True, context={"campaign_id": warband.campaign_id}
        )
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            serializer.save()

            unit_name = hired_sword.name or hired_sword.unit_type or "Unknown Hired Sword"

            if "skill_ids" in request.data:
                new_skill_ids = set(request.data.get("skill_ids", []))
                added_skill_ids = new_skill_ids - old_skill_ids
                if added_skill_ids:
                    added_skills = Skill.objects.filter(id__in=added_skill_ids)
                    for skill in added_skills:
                        skill_type = skill.type or "general"
                        log_warband_event(
                            warband.id,
                            "loadout",
                            "hired_sword_skill",
                            {
                                "hero": unit_name,
                                "skill": skill.name,
                                "skill_type": skill_type,
                            },
                        )

            if "special_ids" in request.data:
                new_special_ids = set(request.data.get("special_ids", []))
                added_special_ids = new_special_ids - old_special_ids
                if added_special_ids:
                    added_specials = Special.objects.filter(id__in=added_special_ids)
                    for special in added_specials:
                        special_type = special.type or "ability"
                        log_warband_event(
                            warband.id,
                            "loadout",
                            "hired_sword_special",
                            {
                                "hero": unit_name,
                                "special": special.name,
                                "special_type": special_type,
                            },
                        )

            if "spell_ids" in request.data:
                new_spell_ids = set(request.data.get("spell_ids", []))
                added_spell_ids = new_spell_ids - old_spell_ids
                if added_spell_ids:
                    added_spells = Spell.objects.filter(id__in=added_spell_ids)
                    for spell in added_spells:
                        spell_type = spell.type or "magic"
                        log_warband_event(
                            warband.id,
                            "loadout",
                            "hired_sword_spell",
                            {
                                "hero": unit_name,
                                "spell": spell.name,
                                "spell_type": spell_type,
                            },
                        )

        # One read with the detail prefetch for the response (PERF-23).
        return Response(HiredSwordDetailSerializer(hired_sword_detail_queryset().get(id=hired_sword.id)).data)

    def delete(self, request, warband_id, hired_sword_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        hired_sword = HiredSword.objects.filter(id=hired_sword_id, warband=warband).first()
        if not hired_sword:
            return Response({"detail": "Not found"}, status=404)

        unit_name = hired_sword.name or "Unknown Hired Sword"
        unit_type = hired_sword.unit_type or "Unknown Type"
        with transaction.atomic():
            log_warband_event(
                warband.id,
                "personnel",
                "remove_hired_sword",
                {
                    "name": unit_name,
                    "type": unit_type,
                },
            )
            hired_sword.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WarbandHiredSwordLevelUpView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    STAT_MAP = {
        "M": "movement",
        "WS": "weapon_skill",
        "BS": "ballistic_skill",
        "S": "strength",
        "T": "toughness",
        "W": "wounds",
        "I": "initiative",
        "A": "attacks",
        "Ld": "leadership",
    }
    STAT_LABELS = {
        "M": "Movement",
        "WS": "Weapon Skill",
        "BS": "Ballistic Skill",
        "S": "Strength",
        "T": "Toughness",
        "W": "Wound",
        "I": "Initiative",
        "A": "Attack",
        "Ld": "Leadership",
        "Skill": "Skill",
        "Spell": "Spell",
        "Special": "Special",
    }

    def post(self, request, warband_id, hired_sword_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        hired_sword = HiredSword.objects.filter(id=hired_sword_id, warband=warband).first()
        if not hired_sword:
            return Response({"detail": "Not found"}, status=404)

        serializer = HiredSwordLevelUpLogSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data.get("payload") or {}

        if (hired_sword.level_up or 0) <= 0 or hired_sword.no_level_ups:
            return Response({"detail": "No level ups available"}, status=400)

        advance = payload.get("advance", {})
        advance_id = advance.get("id") if isinstance(advance, dict) else None
        if not isinstance(advance_id, str) or (
            advance_id not in self.STAT_MAP and advance_id not in PLACEHOLDER_ADVANCES
        ):
            return Response({"detail": "Invalid advance"}, status=400)

        with transaction.atomic():
            stat_field = self.STAT_MAP.get(advance_id)
            if not spend_level_up(hired_sword, stat_field=stat_field, record=advance_record(advance, self.STAT_LABELS)):
                return Response({"detail": "No level ups available"}, status=400)
            if advance_id == "Skill":
                HiredSwordSkill.objects.create(hired_sword=hired_sword, skill=pending_placeholder(Skill, "New Skill"))
            elif advance_id == "Spell":
                HiredSwordSpell.objects.create(hired_sword=hired_sword, spell=pending_placeholder(Spell, "New Spell"))
            elif advance_id == "Special":
                HiredSwordSpecial.objects.create(
                    hired_sword=hired_sword, special=pending_placeholder(Special, "New Special")
                )
            log_warband_event(warband.id, "advance", "hired_sword", payload)

        return Response(HiredSwordDetailSerializer(hired_sword_detail_queryset().get(id=hired_sword.id)).data)
