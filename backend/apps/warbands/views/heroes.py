from django.db import transaction
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.models import CampaignSettings
from apps.campaigns.permissions import get_membership
from apps.logs.utils import log_warband_event
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell
from apps.warbands.models import Hero, HeroSkill, HeroSpecial, HeroSpell
from apps.warbands.permissions import CanEditWarband, CanViewWarband
from apps.warbands.prefetches import HERO_DETAIL_PREFETCH
from apps.warbands.serializers import (
    HeroCreateSerializer,
    HeroDetailSerializer,
    HeroLevelUpLogSerializer,
    HeroSummarySerializer,
    HeroUpdateSerializer,
    SpecialDetailSerializer,
    SpellDetailSerializer,
)
from apps.warbands.services.level_up import (
    PLACEHOLDER_ADVANCES,
    advance_record,
    pending_placeholder,
    spend_level_up,
)
from apps.warbands.utils.leaders import ensure_single_living_leader, lock_warband
from apps.warbands.utils.trades import TradeHelper

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
            Hero.objects.filter(warband=warband, dead=False)
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

        # Validate before reading any key, so a non-object body is a 400 like the other kinds (BUG-91).
        serializer = HeroCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ignore_max_heroes = str(request.data.get("ignore_max_heroes", False)).lower() in ("1", "true", "yes")

        if not ignore_max_heroes:
            campaign_settings = CampaignSettings.objects.filter(campaign=warband.campaign).first()
            max_heroes = campaign_settings.max_heroes if campaign_settings else 6
            if max_heroes is None:
                max_heroes = 6

            if Hero.objects.filter(warband=warband).count() >= max_heroes:
                return Response({"detail": f"Warband already has {max_heroes} heroes"}, status=400)

        with transaction.atomic():
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
            Hero.objects.filter(warband=warband, dead=False)
            .select_related("race")
            .prefetch_related(
                *HERO_DETAIL_PREFETCH,
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
            Hero.objects.filter(id=hero_id, warband=warband, dead=False)
            .select_related("race")
            .prefetch_related(
                *HERO_DETAIL_PREFETCH,
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
            Hero.objects.filter(id=hero_id, warband=warband, dead=False)
            .select_related("race")
            .prefetch_related(
                *HERO_DETAIL_PREFETCH,
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
        with transaction.atomic():
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
        with transaction.atomic():
            lock_warband(warband.id)
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
            ensure_single_living_leader(warband.id)
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

        if (hero.level_up or 0) <= 0:
            return Response({"detail": "No level ups available"}, status=400)

        advance = payload.get("advance", {})
        advance_id = advance.get("id") if isinstance(advance, dict) else None
        if not isinstance(advance_id, str) or (
            advance_id not in self.STAT_MAP and advance_id not in PLACEHOLDER_ADVANCES
        ):
            return Response({"detail": "Invalid advance"}, status=400)

        with transaction.atomic():
            stat_field = self.STAT_MAP.get(advance_id)
            if not spend_level_up(hero, stat_field=stat_field, record=advance_record(advance, self.STAT_LABELS)):
                return Response({"detail": "No level ups available"}, status=400)
            if advance_id == "Skill":
                HeroSkill.objects.create(hero=hero, skill=pending_placeholder(Skill, "New Skill"))
            elif advance_id == "Spell":
                HeroSpell.objects.create(hero=hero, spell=pending_placeholder(Spell, "New Spell"))
            elif advance_id == "Special":
                HeroSpecial.objects.create(hero=hero, special=pending_placeholder(Special, "New Special"))
            log_warband_event(warband.id, "advance", "hero", payload)

        hero.refresh_from_db()
        hero = (
            Hero.objects.filter(id=hero_id)
            .select_related("race")
            .prefetch_related(
                *HERO_DETAIL_PREFETCH,
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
