from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.permissions import (
    get_membership,
    get_writable_membership,
    has_campaign_permission,
    parse_campaign_id,
)
from apps.warbands.models import Warband
from apps.warbands.units.catalogue_scope import in_campaign_scope

from . import writes
from .models import BestiaryEntry, HiredSwordProfile, WarbandBestiaryFavourite
from .selectors import entry_details, hired_sword_details
from .serializers import (
    BestiaryEntrySerializer,
    BestiaryEntrySummarySerializer,
    BestiaryEntryWriteSerializer,
    HiredSwordProfileDetailSerializer,
    HiredSwordProfileSummarySerializer,
    HiredSwordWriteSerializer,
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

        campaign_id = parse_campaign_id(request.query_params.get("campaign_id"))
        if campaign_id is not None:
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
        campaign_id = parse_campaign_id(request.data.get("campaign_id"))
        membership = get_writable_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "edit_catalogue"):
            return Response({"detail": "Forbidden"}, status=403)

        context = {"campaign_id": membership.campaign_id}
        serializer = BestiaryEntryWriteSerializer(data=request.data, context=context)
        serializer.is_valid(raise_exception=True)  # fields and every linked id, before anything is written
        entry = writes.create_entry(membership.campaign_id, serializer.validated_data)
        return Response(BestiaryEntrySerializer(entry_details().get(id=entry.id)).data, status=status.HTTP_201_CREATED)


class BestiaryEntryDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, entry_id):
        entry = entry_details().filter(id=entry_id).first()
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

        membership = get_writable_membership(request.user, entry.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "edit_catalogue"):
            return Response({"detail": "Forbidden"}, status=403)

        context = {"campaign_id": entry.campaign_id}
        serializer = BestiaryEntryWriteSerializer(entry, data=request.data, partial=True, context=context)
        serializer.is_valid(raise_exception=True)
        writes.update_entry(entry, serializer.validated_data)
        return Response(BestiaryEntrySerializer(entry_details().get(id=entry.id)).data)

    def delete(self, request, entry_id):
        entry = BestiaryEntry.objects.filter(id=entry_id).first()
        if not entry:
            return Response({"detail": "Not found"}, status=404)
        if not entry.campaign_id:
            return Response({"detail": "Forbidden"}, status=403)

        membership = get_writable_membership(request.user, entry.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "delete_catalogue"):
            return Response({"detail": "Forbidden"}, status=403)

        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _in_scope(raw_id, campaign_id):
    """The book's or the campaign's entry with this id; another campaign's reads as not found (SEC-07)."""
    if not str(raw_id).isdigit():
        return None
    return in_campaign_scope(BestiaryEntry.objects.filter(id=int(raw_id)), campaign_id).first()


class WarbandBestiaryFavouriteListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband = Warband.objects.filter(id=warband_id).first()
        if not warband:
            return Response({"detail": "Not found"}, status=404)

        membership = get_membership(request.user, warband.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        scope = Q(bestiary_entry__campaign__isnull=True) | Q(bestiary_entry__campaign_id=warband.campaign_id)
        favourites = WarbandBestiaryFavourite.objects.filter(scope, warband=warband).select_related("bestiary_entry")
        entries = [f.bestiary_entry for f in favourites]
        serializer = BestiaryEntrySummarySerializer(entries, many=True)
        return Response(serializer.data)

    def post(self, request, warband_id):
        warband = Warband.objects.filter(id=warband_id).first()
        if not warband:
            return Response({"detail": "Not found"}, status=404)

        membership = get_writable_membership(request.user, warband.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        if warband.user_id != request.user.id:
            if not has_campaign_permission(membership, "manage_warbands"):
                return Response({"detail": "Forbidden"}, status=403)

        entry = _in_scope(request.data.get("bestiary_entry_id"), warband.campaign_id)
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

        membership = get_writable_membership(request.user, warband.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        if warband.user_id != request.user.id:
            if not has_campaign_permission(membership, "manage_warbands"):
                return Response({"detail": "Forbidden"}, status=403)

        WarbandBestiaryFavourite.objects.filter(warband=warband, bestiary_entry_id=entry_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class HiredSwordProfileListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profiles = HiredSwordProfile.objects.select_related("bestiary_entry").prefetch_related(
            "restriction_links__restriction",
        )

        search = request.query_params.get("search")
        if search:
            profiles = profiles.filter(bestiary_entry__name__icontains=search.strip())

        campaign_id = parse_campaign_id(request.query_params.get("campaign_id"))
        if campaign_id is not None:
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
        campaign_id = parse_campaign_id(request.data.get("campaign_id"))
        membership = get_writable_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "edit_catalogue"):
            return Response({"detail": "Forbidden"}, status=403)

        serializer = HiredSwordWriteSerializer(data=request.data, context={"campaign_id": membership.campaign_id})
        serializer.is_valid(raise_exception=True)  # the entry, its links and the profile, before anything is written
        profile = writes.create_hired_sword(membership.campaign_id, serializer.validated_data)
        return Response(
            HiredSwordProfileDetailSerializer(hired_sword_details().get(id=profile.id)).data,
            status=status.HTTP_201_CREATED,
        )


class HiredSwordProfileDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, profile_id):
        profile = hired_sword_details().filter(id=profile_id).first()
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

        membership = get_writable_membership(request.user, profile.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "edit_catalogue"):
            return Response({"detail": "Forbidden"}, status=403)

        context = {"campaign_id": profile.campaign_id}
        entry = profile.bestiary_entry
        serializer = HiredSwordWriteSerializer(entry, data=request.data, partial=True, context=context)
        serializer.is_valid(raise_exception=True)  # costs included: nothing is saved before the whole edit is valid
        writes.update_hired_sword(profile, serializer.validated_data)
        return Response(HiredSwordProfileDetailSerializer(hired_sword_details().get(id=profile.id)).data)

    def delete(self, request, profile_id):
        profile = HiredSwordProfile.objects.select_related("bestiary_entry").filter(id=profile_id).first()
        if not profile:
            return Response({"detail": "Not found"}, status=404)
        if not profile.campaign_id:
            return Response({"detail": "Forbidden"}, status=403)

        membership = get_writable_membership(request.user, profile.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "delete_catalogue"):
            return Response({"detail": "Forbidden"}, status=403)

        profile.bestiary_entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
