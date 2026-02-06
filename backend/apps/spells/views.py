from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.models import Campaign
from apps.campaigns.permissions import get_membership, has_campaign_permission

from .models import Spell
from .serializers import SpellCreateSerializer, SpellSerializer


class SpellListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        spells = Spell.objects.exclude(type="Pending")
        spell_type = request.query_params.get("type")
        if spell_type:
            spells = spells.filter(type__iexact=spell_type.strip())
        search = request.query_params.get("search")
        if search:
            spells = spells.filter(name__icontains=search.strip())

        campaign_id = request.query_params.get("campaign_id")
        if campaign_id:
            membership = get_membership(request.user, campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

            campaign = (
                Campaign.objects.select_related("campaign_type")
                .filter(id=campaign_id)
                .first()
            )
            if not campaign:
                return Response({"detail": "Not found"}, status=404)

            campaign_spells = spells.filter(campaign_id=campaign_id)
            base_spells = spells.filter(
                campaign__isnull=True,
                campaign_types__campaign_type=campaign.campaign_type,
            )
            if campaign_spells.exists():
                base_spells = base_spells.exclude(
                    name__in=campaign_spells.values_list("name", flat=True)
                )
            merged = list(campaign_spells.order_by("name", "id")) + list(
                base_spells.order_by("name", "id")
            )
            serializer = SpellSerializer(merged, many=True)
            return Response(serializer.data)

        spells = spells.filter(campaign__isnull=True)
        serializer = SpellSerializer(spells.order_by("name", "id"), many=True)
        return Response(serializer.data)

    def post(self, request):
        campaign_id = request.data.get("campaign_id")
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "add_custom"):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        data["campaign"] = campaign_id
        serializer = SpellCreateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        spell = serializer.save()
        return Response(SpellSerializer(spell).data, status=status.HTTP_201_CREATED)


class SpellDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, spell_id):
        spell = Spell.objects.filter(id=spell_id).first()
        if not spell:
            return Response({"detail": "Not found"}, status=404)

        if spell.campaign_id:
            membership = get_membership(request.user, spell.campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

        return Response(SpellSerializer(spell).data)

    def patch(self, request, spell_id):
        spell = Spell.objects.filter(id=spell_id).first()
        if not spell:
            return Response({"detail": "Not found"}, status=404)
        if not spell.campaign_id:
            return Response({"detail": "Forbidden"}, status=403)

        membership = get_membership(request.user, spell.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_spells"):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        data.pop("campaign", None)
        serializer = SpellCreateSerializer(spell, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(SpellSerializer(spell).data)

    def delete(self, request, spell_id):
        spell = Spell.objects.filter(id=spell_id).first()
        if not spell:
            return Response({"detail": "Not found"}, status=404)
        if not spell.campaign_id:
            return Response({"detail": "Forbidden"}, status=403)

        membership = get_membership(request.user, spell.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_spells"):
            return Response({"detail": "Forbidden"}, status=403)

        spell.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
