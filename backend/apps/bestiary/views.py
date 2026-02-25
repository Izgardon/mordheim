from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.permissions import get_membership, has_campaign_permission
from apps.warbands.models import Warband

from .models import (
    BestiaryEntry,
    BestiaryEntryItem,
    BestiaryEntrySkill,
    BestiaryEntrySpecial,
    BestiaryEntrySpell,
    WarbandBestiaryFavourite,
)
from .serializers import (
    BestiaryEntryCreateSerializer,
    BestiaryEntrySerializer,
    BestiaryEntrySummarySerializer,
)


class BestiaryEntryListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        entries = BestiaryEntry.objects.all()

        entry_type = request.query_params.get("type")
        if entry_type:
            entries = entries.filter(type__iexact=entry_type.strip())

        search = request.query_params.get("search")
        if search:
            entries = entries.filter(name__icontains=search.strip())

        campaign_id = request.query_params.get("campaign_id")
        if campaign_id:
            membership = get_membership(request.user, campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

            campaign_entries = entries.filter(campaign_id=campaign_id)
            base_entries = entries.filter(campaign__isnull=True)
            if campaign_entries.exists():
                base_entries = base_entries.exclude(
                    name__in=campaign_entries.values_list("name", flat=True)
                )
            merged = list(campaign_entries.order_by("name", "id")) + list(
                base_entries.order_by("name", "id")
            )
            serializer = BestiaryEntrySummarySerializer(merged, many=True)
            return Response(serializer.data)

        entries = entries.filter(campaign__isnull=True)
        serializer = BestiaryEntrySummarySerializer(
            entries.order_by("name", "id"), many=True
        )
        return Response(serializer.data)

    def post(self, request):
        campaign_id = request.data.get("campaign_id")
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_bestiary"):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        data["campaign"] = campaign_id
        serializer = BestiaryEntryCreateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        entry = serializer.save()

        _sync_m2m(entry, request.data)

        return Response(
            BestiaryEntrySerializer(entry).data, status=status.HTTP_201_CREATED
        )


class BestiaryEntryDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, entry_id):
        entry = (
            BestiaryEntry.objects.prefetch_related(
                "bestiary_entry_skills__skill",
                "bestiary_entry_specials__special",
                "bestiary_entry_spells__spell",
                "bestiary_entry_items__item",
            )
            .filter(id=entry_id)
            .first()
        )
        if not entry:
            return Response({"detail": "Not found"}, status=404)

        if entry.campaign_id:
            membership = get_membership(request.user, entry.campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

        return Response(BestiaryEntrySerializer(entry).data)

    def patch(self, request, entry_id):
        entry = BestiaryEntry.objects.filter(id=entry_id).first()
        if not entry:
            return Response({"detail": "Not found"}, status=404)
        if not entry.campaign_id:
            return Response({"detail": "Forbidden"}, status=403)

        membership = get_membership(request.user, entry.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_bestiary"):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        data.pop("campaign", None)
        serializer = BestiaryEntryCreateSerializer(entry, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        _sync_m2m(entry, request.data)

        entry.refresh_from_db()
        return Response(BestiaryEntrySerializer(entry).data)

    def delete(self, request, entry_id):
        entry = BestiaryEntry.objects.filter(id=entry_id).first()
        if not entry:
            return Response({"detail": "Not found"}, status=404)
        if not entry.campaign_id:
            return Response({"detail": "Forbidden"}, status=403)

        membership = get_membership(request.user, entry.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_bestiary"):
            return Response({"detail": "Forbidden"}, status=403)

        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WarbandBestiaryFavouriteListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband = Warband.objects.filter(id=warband_id).first()
        if not warband:
            return Response({"detail": "Not found"}, status=404)

        membership = get_membership(request.user, warband.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        favourites = WarbandBestiaryFavourite.objects.filter(
            warband=warband
        ).select_related("bestiary_entry")
        entries = [f.bestiary_entry for f in favourites]
        serializer = BestiaryEntrySummarySerializer(entries, many=True)
        return Response(serializer.data)

    def post(self, request, warband_id):
        warband = Warband.objects.filter(id=warband_id).first()
        if not warband:
            return Response({"detail": "Not found"}, status=404)

        membership = get_membership(request.user, warband.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        if warband.user_id != request.user.id:
            if not has_campaign_permission(membership, "manage_warbands"):
                return Response({"detail": "Forbidden"}, status=403)

        entry_id = request.data.get("bestiary_entry_id")
        entry = BestiaryEntry.objects.filter(id=entry_id).first()
        if not entry:
            return Response({"detail": "Bestiary entry not found"}, status=404)

        WarbandBestiaryFavourite.objects.get_or_create(
            warband=warband, bestiary_entry=entry
        )
        return Response(status=status.HTTP_201_CREATED)


class WarbandBestiaryFavouriteDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, warband_id, entry_id):
        warband = Warband.objects.filter(id=warband_id).first()
        if not warband:
            return Response({"detail": "Not found"}, status=404)

        membership = get_membership(request.user, warband.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        if warband.user_id != request.user.id:
            if not has_campaign_permission(membership, "manage_warbands"):
                return Response({"detail": "Forbidden"}, status=403)

        WarbandBestiaryFavourite.objects.filter(
            warband=warband, bestiary_entry_id=entry_id
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _sync_m2m(entry, data):
    """Sync M2M relationships from request data if provided."""
    skill_ids = data.get("skill_ids")
    if skill_ids is not None:
        BestiaryEntrySkill.objects.filter(bestiary_entry=entry).delete()
        for skill_id in skill_ids:
            BestiaryEntrySkill.objects.get_or_create(
                bestiary_entry=entry, skill_id=skill_id
            )

    special_ids = data.get("special_ids")
    if special_ids is not None:
        BestiaryEntrySpecial.objects.filter(bestiary_entry=entry).delete()
        for special_id in special_ids:
            BestiaryEntrySpecial.objects.get_or_create(
                bestiary_entry=entry, special_id=special_id
            )

    spell_ids = data.get("spell_ids")
    if spell_ids is not None:
        BestiaryEntrySpell.objects.filter(bestiary_entry=entry).delete()
        for spell_id in spell_ids:
            BestiaryEntrySpell.objects.get_or_create(
                bestiary_entry=entry, spell_id=spell_id
            )

    item_entries = data.get("item_entries")
    if item_entries is not None:
        BestiaryEntryItem.objects.filter(bestiary_entry=entry).delete()
        for item_entry in item_entries:
            item_id = item_entry.get("item_id") if isinstance(item_entry, dict) else item_entry
            quantity = item_entry.get("quantity", 1) if isinstance(item_entry, dict) else 1
            BestiaryEntryItem.objects.get_or_create(
                bestiary_entry=entry,
                item_id=item_id,
                defaults={"quantity": quantity},
            )
