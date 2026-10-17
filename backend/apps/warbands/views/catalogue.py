"""Catalogue detail reads served under warbands/ (they move to their catalogue apps in pass 5)."""

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.permissions import get_membership
from apps.special.models import Special
from apps.spells.models import Spell
from apps.warbands.units.catalogue import SpecialDetailSerializer, SpellDetailSerializer


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
