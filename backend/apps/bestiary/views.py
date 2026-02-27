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
    HiredSwordProfile,
    HiredSwordProfileAvailableSkill,
    HiredSwordProfileRestriction,
    WarbandBestiaryFavourite,
)
from .serializers import (
    BestiaryEntryCreateSerializer,
    BestiaryEntrySerializer,
    BestiaryEntrySummarySerializer,
    HiredSwordProfileDetailSerializer,
    HiredSwordProfileSummarySerializer,
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
                base_entries = base_entries.exclude(name__in=campaign_entries.values_list("name", flat=True))
            merged = list(campaign_entries.order_by("name", "id")) + list(base_entries.order_by("name", "id"))
            serializer = BestiaryEntrySummarySerializer(merged, many=True)
            return Response(serializer.data)

        entries = entries.filter(campaign__isnull=True)
        serializer = BestiaryEntrySummarySerializer(entries.order_by("name", "id"), many=True)
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

        return Response(BestiaryEntrySerializer(entry).data, status=status.HTTP_201_CREATED)


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

        favourites = WarbandBestiaryFavourite.objects.filter(warband=warband).select_related("bestiary_entry")
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

        WarbandBestiaryFavourite.objects.get_or_create(warband=warband, bestiary_entry=entry)
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

        WarbandBestiaryFavourite.objects.filter(warband=warband, bestiary_entry_id=entry_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _sync_m2m(entry, data):
    """Sync M2M relationships from request data if provided."""
    skill_ids = data.get("skill_ids")
    if skill_ids is not None:
        BestiaryEntrySkill.objects.filter(bestiary_entry=entry).delete()
        for skill_id in skill_ids:
            BestiaryEntrySkill.objects.get_or_create(bestiary_entry=entry, skill_id=skill_id)

    special_ids = data.get("special_ids")
    if special_ids is not None:
        BestiaryEntrySpecial.objects.filter(bestiary_entry=entry).delete()
        for special_id in special_ids:
            BestiaryEntrySpecial.objects.get_or_create(bestiary_entry=entry, special_id=special_id)

    spell_ids = data.get("spell_ids")
    if spell_ids is not None:
        BestiaryEntrySpell.objects.filter(bestiary_entry=entry).delete()
        for spell_id in spell_ids:
            BestiaryEntrySpell.objects.get_or_create(bestiary_entry=entry, spell_id=spell_id)

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


def _sync_hired_sword_profile_restrictions(profile, restriction_entries):
    HiredSwordProfileRestriction.objects.filter(hired_sword_profile=profile).delete()
    if not restriction_entries:
        return
    for entry in restriction_entries:
        if isinstance(entry, dict):
            restriction_id = entry.get("restriction_id")
            additional_note = entry.get("additional_note", "")
        else:
            restriction_id = entry
            additional_note = ""
        HiredSwordProfileRestriction.objects.get_or_create(
            hired_sword_profile=profile,
            restriction_id=restriction_id,
            additional_note=additional_note,
        )


def _sync_hired_sword_available_skills(profile, skill_ids):
    HiredSwordProfileAvailableSkill.objects.filter(hired_sword_profile=profile).delete()
    if not skill_ids:
        return
    for skill_id in skill_ids:
        HiredSwordProfileAvailableSkill.objects.get_or_create(hired_sword_profile=profile, skill_id=skill_id)


class HiredSwordProfileListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profiles = HiredSwordProfile.objects.select_related("bestiary_entry").prefetch_related(
            "restriction_links__restriction",
            "hired_sword_profile_available_skills__skill",
        )

        search = request.query_params.get("search")
        if search:
            profiles = profiles.filter(bestiary_entry__name__icontains=search.strip())

        campaign_id = request.query_params.get("campaign_id")
        if campaign_id:
            membership = get_membership(request.user, campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

            campaign_profiles = profiles.filter(campaign_id=campaign_id)
            base_profiles = profiles.filter(campaign__isnull=True)
            if campaign_profiles.exists():
                base_profiles = base_profiles.exclude(
                    bestiary_entry__name__in=campaign_profiles.values_list("bestiary_entry__name", flat=True)
                )
            merged = list(campaign_profiles.order_by("bestiary_entry__name")) + list(
                base_profiles.order_by("bestiary_entry__name")
            )
            serializer = HiredSwordProfileSummarySerializer(merged, many=True)
            return Response(serializer.data)

        profiles = profiles.filter(campaign__isnull=True)
        serializer = HiredSwordProfileSummarySerializer(profiles.order_by("bestiary_entry__name"), many=True)
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
        data.setdefault("type", "Hired Sword")

        hire_cost = data.pop("hire_cost", None)
        hire_cost_expression = data.pop("hire_cost_expression", "")
        upkeep_cost = data.pop("upkeep_cost", None)
        upkeep_cost_expression = data.pop("upkeep_cost_expression", "")
        restriction_entries = data.pop("restriction_ids", None)
        available_skill_types = data.pop("available_skill_types", None)
        available_special_skill_ids = data.pop("available_special_skill_ids", None)

        serializer = BestiaryEntryCreateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        entry = serializer.save()

        _sync_m2m(entry, request.data)

        profile = HiredSwordProfile.objects.create(
            campaign_id=campaign_id,
            bestiary_entry=entry,
            hire_cost=hire_cost,
            hire_cost_expression=hire_cost_expression or "",
            upkeep_cost=upkeep_cost,
            upkeep_cost_expression=upkeep_cost_expression or "",
            available_skill_types=available_skill_types or {},
        )

        if restriction_entries is not None:
            _sync_hired_sword_profile_restrictions(profile, restriction_entries)

        if available_special_skill_ids is not None:
            _sync_hired_sword_available_skills(profile, available_special_skill_ids)

        return Response(
            HiredSwordProfileDetailSerializer(profile).data,
            status=status.HTTP_201_CREATED,
        )


class HiredSwordProfileDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, profile_id):
        profile = (
            HiredSwordProfile.objects.select_related("bestiary_entry")
            .prefetch_related(
                "bestiary_entry__bestiary_entry_skills__skill",
                "bestiary_entry__bestiary_entry_specials__special",
                "bestiary_entry__bestiary_entry_spells__spell",
                "bestiary_entry__bestiary_entry_items__item",
                "restriction_links__restriction",
                "hired_sword_profile_available_skills__skill",
            )
            .filter(id=profile_id)
            .first()
        )
        if not profile:
            return Response({"detail": "Not found"}, status=404)

        if profile.campaign_id:
            membership = get_membership(request.user, profile.campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

        return Response(HiredSwordProfileDetailSerializer(profile).data)

    def patch(self, request, profile_id):
        profile = HiredSwordProfile.objects.select_related("bestiary_entry").filter(id=profile_id).first()
        if not profile:
            return Response({"detail": "Not found"}, status=404)
        if not profile.campaign_id:
            return Response({"detail": "Forbidden"}, status=403)

        membership = get_membership(request.user, profile.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_bestiary"):
            return Response({"detail": "Forbidden"}, status=403)

        if "hire_cost" in request.data:
            profile.hire_cost = request.data["hire_cost"]
        if "hire_cost_expression" in request.data:
            profile.hire_cost_expression = request.data["hire_cost_expression"]
        if "upkeep_cost" in request.data:
            profile.upkeep_cost = request.data["upkeep_cost"]
        if "upkeep_cost_expression" in request.data:
            profile.upkeep_cost_expression = request.data["upkeep_cost_expression"]
        if "available_skill_types" in request.data:
            profile.available_skill_types = request.data["available_skill_types"]
        profile.save()

        available_special_skill_ids = request.data.get("available_special_skill_ids")
        if available_special_skill_ids is not None:
            _sync_hired_sword_available_skills(profile, available_special_skill_ids)

        entry = profile.bestiary_entry
        entry_data = request.data.copy()
        for key in (
            "campaign_id",
            "campaign",
            "hire_cost",
            "hire_cost_expression",
            "upkeep_cost",
            "upkeep_cost_expression",
            "restriction_ids",
            "available_skill_types",
            "available_special_skill_ids",
        ):
            entry_data.pop(key, None)

        if entry_data:
            serializer = BestiaryEntryCreateSerializer(entry, data=entry_data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()

        _sync_m2m(entry, request.data)

        restriction_entries = request.data.get("restriction_ids")
        if restriction_entries is not None:
            _sync_hired_sword_profile_restrictions(profile, restriction_entries)

        profile.refresh_from_db()
        return Response(HiredSwordProfileDetailSerializer(profile).data)

    def delete(self, request, profile_id):
        profile = HiredSwordProfile.objects.select_related("bestiary_entry").filter(id=profile_id).first()
        if not profile:
            return Response({"detail": "Not found"}, status=404)
        if not profile.campaign_id:
            return Response({"detail": "Forbidden"}, status=403)

        membership = get_membership(request.user, profile.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_bestiary"):
            return Response({"detail": "Forbidden"}, status=403)

        profile.bestiary_entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
