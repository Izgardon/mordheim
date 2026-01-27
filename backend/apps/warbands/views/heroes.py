from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.logs.utils import log_warband_event
from apps.warbands.models import Hero, HeroOther, HeroSpell
from apps.warbands.permissions import CanEditWarband, CanViewWarband
from apps.warbands.serializers import (
    HeroCreateSerializer,
    HeroDetailSerializer,
    HeroOtherDetailSerializer,
    HeroSpellDetailSerializer,
    HeroSummarySerializer,
    HeroUpdateSerializer,
)

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
            .prefetch_related("hero_items__item", "skills", "other_entries", "spells")
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

        max_heroes = warband.campaign.max_heroes if warband.campaign else 6
        if max_heroes is None:
            max_heroes = 6

        if Hero.objects.filter(warband=warband).count() >= max_heroes:
            return Response(
                {"detail": f"Warband already has {max_heroes} heroes"}, status=400
            )

        serializer = HeroCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        hero = serializer.save(warband=warband)
        log_warband_event(
            warband.id,
            "personnel",
            "new_hero",
            {"name": hero.name or "Unknown", "type": hero.unit_type or "Unknown"},
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
                "skills",
                "other_entries",
                "spells",
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
                "skills",
                "other_entries",
                "spells",
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
                "skills",
                "other_entries",
                "spells",
            )
            .first()
        )
        if not hero:
            return Response({"detail": "Not found"}, status=404)

        serializer = HeroUpdateSerializer(hero, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
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

        hero.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class HeroOtherDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, other_id):
        other = (
            HeroOther.objects.select_related("hero__warband__campaign")
            .filter(id=other_id)
            .first()
        )
        if not other or not other.hero or not other.hero.warband:
            return Response({"detail": "Not found"}, status=404)

        if not CanViewWarband().has_object_permission(request, self, other.hero.warband):
            return Response({"detail": "Not found"}, status=404)

        return Response(HeroOtherDetailSerializer(other).data)


class HeroSpellDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, spell_id):
        spell = (
            HeroSpell.objects.select_related("hero__warband__campaign")
            .filter(id=spell_id)
            .first()
        )
        if not spell or not spell.hero or not spell.hero.warband:
            return Response({"detail": "Not found"}, status=404)

        if not CanViewWarband().has_object_permission(request, self, spell.hero.warband):
            return Response({"detail": "Not found"}, status=404)

        return Response(HeroSpellDetailSerializer(spell).data)
