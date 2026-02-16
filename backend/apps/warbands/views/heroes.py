from rest_framework import permissions, status
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.logs.utils import log_warband_event
from apps.special.models import Special
from apps.skills.models import Skill
from apps.spells.models import Spell
from apps.warbands.models import Hero, HeroSkill, HeroSpell, HeroSpecial
from apps.warbands.utils.trades import TradeHelper
from apps.warbands.permissions import CanEditWarband, CanViewWarband
from apps.warbands.serializers import (
    HeroCreateSerializer,
    HeroDetailSerializer,
    HeroLevelUpLogSerializer,
    HeroSummarySerializer,
    HeroUpdateSerializer,
    SpecialDetailSerializer,
    SpellDetailSerializer,
)
from apps.campaigns.permissions import get_membership
from apps.campaigns.models import CampaignSettings

from .mixins import WarbandObjectMixin


class WarbandHeroListCreateView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        heroes = (
            Hero.objects.filter(warband=warband)
            .select_related("race")
            .prefetch_related(
                "hero_items__item",
                "hero_skills__skill",
                "hero_specials__special",
                "hero_spells__spell",
            )
            .order_by("id")
        )
        serializer = HeroSummarySerializer(heroes, many=True)
        return Response(serializer.data)

    def post(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        ignore_max_heroes = data.pop("ignore_max_heroes", False)
        ignore_max_heroes = str(ignore_max_heroes).lower() in ("1", "true", "yes")

        if not ignore_max_heroes:
            campaign_settings = CampaignSettings.objects.filter(
                campaign=warband.campaign
            ).first()
            max_heroes = campaign_settings.max_heroes if campaign_settings else 6
            if max_heroes is None:
                max_heroes = 6

            if Hero.objects.filter(warband=warband).count() >= max_heroes:
                return Response(
                    {"detail": f"Warband already has {max_heroes} heroes"}, status=400
                )

        serializer = HeroCreateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        hero = serializer.save(warband=warband)
        log_warband_event(
            warband.id,
            "personnel",
            "new_hero",
            {"name": hero.name or "Unknown", "type": hero.unit_type or "Unknown"},
        )
        if hero.price and hero.price > 0:
            hero_name = hero.name or "Unknown"
            hero_type = hero.unit_type or "Unknown"
            TradeHelper.create_trade(
                warband=warband,
                action="Recruited",
                description=f"{hero_name} the {hero_type}",
                price=hero.price,
                notes="",
            )
        return Response(HeroDetailSerializer(hero).data, status=status.HTTP_201_CREATED)


class WarbandHeroDetailListView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        heroes = (
            Hero.objects.filter(warband=warband)
            .select_related("race")
            .prefetch_related(
                "hero_items__item__property_links__property",
                "hero_skills__skill",
                "hero_specials__special",
                "hero_spells__spell",
            )
            .order_by("id")
        )
        return Response(HeroDetailSerializer(heroes, many=True).data)


class WarbandHeroDetailView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id, hero_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        hero = (
            Hero.objects.filter(id=hero_id, warband=warband)
            .select_related("race")
            .prefetch_related(
                "hero_items__item__property_links__property",
                "hero_skills__skill",
                "hero_specials__special",
                "hero_spells__spell",
            )
            .first()
        )
        if not hero:
            return Response({"detail": "Not found"}, status=404)

        return Response(HeroDetailSerializer(hero).data)

    def patch(self, request, warband_id, hero_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        hero = (
            Hero.objects.filter(id=hero_id, warband=warband)
            .select_related("race")
            .prefetch_related(
                "hero_items__item__property_links__property",
                "hero_skills__skill",
                "hero_specials__special",
                "hero_spells__spell",
            )
            .first()
        )
        if not hero:
            return Response({"detail": "Not found"}, status=404)

        old_skill_ids = {entry.skill_id for entry in hero.hero_skills.all() if entry.skill_id}
        old_special_ids = {entry.special_id for entry in hero.hero_specials.all() if entry.special_id}
        old_spell_ids = {entry.spell_id for entry in hero.hero_spells.all() if entry.spell_id}

        serializer = HeroUpdateSerializer(hero, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        hero_name = hero.name or hero.unit_type or "Unknown Hero"

        if "skill_ids" in request.data:
            new_skill_ids = set(request.data.get("skill_ids", []))
            added_skill_ids = new_skill_ids - old_skill_ids
            if added_skill_ids:
                from apps.skills.models import Skill
                added_skills = Skill.objects.filter(id__in=added_skill_ids)
                for skill in added_skills:
                    skill_type = skill.type or "general"
                    log_warband_event(
                        warband.id,
                        "loadout",
                        "hero_skill",
                        {
                            "hero": hero_name,
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
                        "hero_special",
                        {
                            "hero": hero_name,
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
                        "hero_spell",
                        {
                            "hero": hero_name,
                            "spell": spell.name,
                            "spell_type": spell_type,
                        },
                    )

        return Response(HeroDetailSerializer(hero).data)

    def delete(self, request, warband_id, hero_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        hero = Hero.objects.filter(id=hero_id, warband=warband).first()
        if not hero:
            return Response({"detail": "Not found"}, status=404)

        hero_name = hero.name or "Unknown Hero"
        hero_type = hero.unit_type or "Unknown Type"
        log_warband_event(
            warband.id,
            "personnel",
            "remove_hero",
            {
                "name": hero_name,
                "type": hero_type,
            },
        )
        hero.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WarbandHeroLevelUpView(WarbandObjectMixin, APIView):
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

    def post(self, request, warband_id, hero_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        hero = Hero.objects.filter(id=hero_id, warband=warband).first()
        if not hero:
            return Response({"detail": "Not found"}, status=404)

        serializer = HeroLevelUpLogSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data.get("payload") or {}

        current_level_ups = hero.level_up or 0
        if current_level_ups <= 0:
            return Response({"detail": "No level ups available"}, status=400)

        advance = payload.get("advance", {})
        advance_id = advance.get("id") if isinstance(advance, dict) else None

        update_fields = ["level_up"]

        if advance_id in self.STAT_MAP:
            stat_field = self.STAT_MAP[advance_id]
            current_value = getattr(hero, stat_field, 0) or 0
            new_value = min(10, current_value + 1)
            setattr(hero, stat_field, new_value)
            update_fields.append(stat_field)
        elif advance_id == "Skill":
            new_skill = Skill.objects.filter(
                campaign__isnull=True, name="New Skill", type="Pending"
            ).first()
            if new_skill:
                HeroSkill.objects.create(hero=hero, skill=new_skill)
        elif advance_id == "Spell":
            new_spell = Spell.objects.filter(
                campaign__isnull=True, name="New Spell", type="Pending"
            ).first()
            if new_spell:
                HeroSpell.objects.create(hero=hero, spell=new_spell)
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
                HeroSpecial.objects.create(hero=hero, special=new_special)

        if advance_id:
            advance_label = None
            if isinstance(advance, dict):
                advance_label = advance.get("label")
            if not isinstance(advance_label, str) or not advance_label.strip():
                advance_label = self.STAT_LABELS.get(advance_id, advance_id)
            history = list(hero.level_up_history or [])
            history.append(
                {
                    "code": advance_id,
                    "label": advance_label,
                    "timestamp": timezone.now().isoformat(),
                }
            )
            hero.level_up_history = history
            update_fields.append("level_up_history")

        hero.level_up = max(0, current_level_ups - 1)
        hero.save(update_fields=update_fields)

        log_warband_event(warband.id, "advance", "hero", payload)

        hero.refresh_from_db()
        hero = (
            Hero.objects.filter(id=hero_id)
            .select_related("race")
            .prefetch_related(
                "hero_items__item__property_links__property",
                "hero_skills__skill",
                "hero_specials__special",
                "hero_spells__spell",
            )
            .first()
        )

        return Response(HeroDetailSerializer(hero).data)


class HeroSpecialDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, special_id):
        special = Special.objects.filter(id=special_id).first()
        if not special:
            return Response({"detail": "Not found"}, status=404)

        if special.campaign_id:
            membership = get_membership(request.user, special.campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

        return Response(SpecialDetailSerializer(special).data)


class HeroSpellDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, spell_id):
        spell = Spell.objects.filter(id=spell_id).first()
        if not spell:
            return Response({"detail": "Not found"}, status=404)

        if spell.campaign_id:
            membership = get_membership(request.user, spell.campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

        return Response(SpellDetailSerializer(spell).data)
