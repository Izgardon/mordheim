from django.db import transaction
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.models import CampaignSettings
from apps.campaigns.permissions import get_membership
from apps.logs.utils import log_warband_event
from apps.special.models import Special
from apps.spells.models import Spell
from apps.warbands.models import Hero
from apps.warbands.permissions import CanEditWarband, CanViewWarband
from apps.warbands.prefetches import HERO_DETAIL_PREFETCH, HERO_SUMMARY_PREFETCH, hero_detail_queryset
from apps.warbands.serializers import (
    HeroCreateSerializer,
    HeroDetailSerializer,
    HeroSummarySerializer,
    HeroUpdateSerializer,
    SpecialDetailSerializer,
    SpellDetailSerializer,
)
from apps.warbands.units.services.loadout import linked_ids
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
                *HERO_SUMMARY_PREFETCH,
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
        serializer = HeroCreateSerializer(data=request.data, context={"campaign_id": warband.campaign_id})
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
            .select_related("warband__campaign__settings")
            .first()
        )
        if not hero:
            return Response({"detail": "Not found"}, status=404)

        # Read only the loadout lists this write replaces, to log what it adds.
        old_skill_ids = linked_ids(hero.hero_skills, "skill_id") if "skill_ids" in request.data else set()
        old_special_ids = linked_ids(hero.hero_specials, "special_id") if "special_ids" in request.data else set()
        old_spell_ids = linked_ids(hero.hero_spells, "spell_id") if "spell_ids" in request.data else set()

        serializer = HeroUpdateSerializer(
            hero, data=request.data, partial=True, context={"campaign_id": warband.campaign_id}
        )
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

        # One read with the detail prefetch for the response (PERF-23).
        return Response(HeroDetailSerializer(hero_detail_queryset().get(id=hero.id)).data)

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
