from rest_framework import permissions, status
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.logs.utils import log_warband_event
from apps.special.models import Special
from apps.skills.models import Skill
from apps.spells.models import Spell
from apps.warbands.models import (
    HiredSword,
    HiredSwordSkill,
    HiredSwordSpell,
    HiredSwordSpecial,
)
from apps.warbands.utils.trades import TradeHelper
from apps.warbands.permissions import CanEditWarband, CanViewWarband
from apps.warbands.serializers import (
    HiredSwordCreateSerializer,
    HiredSwordDetailSerializer,
    HiredSwordLevelUpLogSerializer,
    HiredSwordSummarySerializer,
    HiredSwordUpdateSerializer,
)
from apps.campaigns.models import CampaignSettings

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
            HiredSword.objects.filter(warband=warband)
            .select_related("race")
            .prefetch_related(
                "hired_sword_items__item",
                "hired_sword_skills__skill",
                "hired_sword_specials__special",
                "hired_sword_spells__spell",
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

        campaign_settings = CampaignSettings.objects.filter(
            campaign=warband.campaign
        ).first()
        max_hired = campaign_settings.max_hired_swords if campaign_settings else 3
        if max_hired is None:
            max_hired = 3

        if HiredSword.objects.filter(warband=warband).count() >= max_hired:
            return Response(
                {"detail": f"Warband already has {max_hired} hired swords"}, status=400
            )

        serializer = HiredSwordCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
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
            HiredSword.objects.filter(warband=warband)
            .select_related("race")
            .prefetch_related(
                "hired_sword_items__item__property_links__property",
                "hired_sword_skills__skill",
                "hired_sword_specials__special",
                "hired_sword_spells__spell",
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
            HiredSword.objects.filter(id=hired_sword_id, warband=warband)
            .select_related("race")
            .prefetch_related(
                "hired_sword_items__item__property_links__property",
                "hired_sword_skills__skill",
                "hired_sword_specials__special",
                "hired_sword_spells__spell",
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
            HiredSword.objects.filter(id=hired_sword_id, warband=warband)
            .select_related("race")
            .prefetch_related(
                "hired_sword_items__item__property_links__property",
                "hired_sword_skills__skill",
                "hired_sword_specials__special",
                "hired_sword_spells__spell",
            )
            .first()
        )
        if not hired_sword:
            return Response({"detail": "Not found"}, status=404)

        old_skill_ids = {entry.skill_id for entry in hired_sword.hired_sword_skills.all() if entry.skill_id}
        old_special_ids = {entry.special_id for entry in hired_sword.hired_sword_specials.all() if entry.special_id}
        old_spell_ids = {entry.spell_id for entry in hired_sword.hired_sword_spells.all() if entry.spell_id}

        serializer = HiredSwordUpdateSerializer(hired_sword, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
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

        return Response(HiredSwordDetailSerializer(hired_sword).data)

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

        current_level_ups = hired_sword.level_up or 0
        if current_level_ups <= 0:
            return Response({"detail": "No level ups available"}, status=400)

        advance = payload.get("advance", {})
        advance_id = advance.get("id") if isinstance(advance, dict) else None

        update_fields = ["level_up"]

        if advance_id in self.STAT_MAP:
            stat_field = self.STAT_MAP[advance_id]
            current_value = getattr(hired_sword, stat_field, 0) or 0
            new_value = min(10, current_value + 1)
            setattr(hired_sword, stat_field, new_value)
            update_fields.append(stat_field)
        elif advance_id == "Skill":
            new_skill = Skill.objects.filter(
                campaign__isnull=True, name="New Skill", type="Pending"
            ).first()
            if new_skill:
                HiredSwordSkill.objects.create(hired_sword=hired_sword, skill=new_skill)
        elif advance_id == "Spell":
            new_spell = Spell.objects.filter(
                campaign__isnull=True, name="New Spell", type="Pending"
            ).first()
            if new_spell:
                HiredSwordSpell.objects.create(hired_sword=hired_sword, spell=new_spell)
        elif advance_id == "Special":
            new_special = Special.objects.filter(
                campaign__isnull=True, name="New Special", type="Pending"
            ).first()
            if not new_special:
                new_special = Special.objects.filter(
                    name="New Special", type="Pending"
                ).first()
            if not new_special:
                new_special = Special.objects.create(
                    name="New Special", type="Pending", description=""
                )
            if new_special:
                HiredSwordSpecial.objects.create(hired_sword=hired_sword, special=new_special)

        if advance_id:
            advance_label = None
            if isinstance(advance, dict):
                advance_label = advance.get("label")
            if not isinstance(advance_label, str) or not advance_label.strip():
                advance_label = self.STAT_LABELS.get(advance_id, advance_id)
            history = list(hired_sword.level_up_history or [])
            history.append(
                {
                    "code": advance_id,
                    "label": advance_label,
                    "timestamp": timezone.now().isoformat(),
                }
            )
            hired_sword.level_up_history = history
            update_fields.append("level_up_history")

        hired_sword.level_up = max(0, current_level_ups - 1)
        hired_sword.save(update_fields=update_fields)

        log_warband_event(warband.id, "advance", "hired_sword", payload)

        hired_sword.refresh_from_db()
        hired_sword = (
            HiredSword.objects.filter(id=hired_sword_id)
            .select_related("race")
            .prefetch_related(
                "hired_sword_items__item__property_links__property",
                "hired_sword_skills__skill",
                "hired_sword_specials__special",
                "hired_sword_spells__spell",
            )
            .first()
        )

        return Response(HiredSwordDetailSerializer(hired_sword).data)
