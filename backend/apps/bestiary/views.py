from django.db.models import Q
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.core.catalogue.kinds import BESTIARY
from apps.core.catalogue.views import CatalogueDetailView, CatalogueListView
from apps.warbands.units.catalogue_scope import current_entry
from apps.warbands.views.base import WarbandScopedView

from .models import BestiaryEntry, WarbandBestiaryFavourite
from .serializers import BestiaryEntrySummarySerializer


class BestiaryEntryListView(CatalogueListView):
    kind = BESTIARY


class BestiaryEntryDetailView(CatalogueDetailView):
    kind = BESTIARY


def _in_scope(raw_id, campaign_id):
    """The campaign's current entry for this id (its version of a book entry, CAT-TWEAK-03); another campaign's reads
    as not found (SEC-07)."""
    if not str(raw_id).isdigit():
        return None
    return current_entry(BestiaryEntry.objects.all(), int(raw_id), campaign_id)


class WarbandBestiaryFavouriteListView(WarbandScopedView):
    # a warband's favourites: read by its campaign's members, changed by its owner or a manage_warbands holder

    def get(self, request: Request, warband_id: int) -> Response:
        campaign_id = self.warband.campaign_id
        scope = Q(bestiary_entry__campaign__isnull=True) | Q(bestiary_entry__campaign_id=campaign_id)
        favourites = WarbandBestiaryFavourite.objects.filter(scope, warband=self.warband).select_related(
            "bestiary_entry"
        )
        entries = [f.bestiary_entry for f in favourites]
        return Response(BestiaryEntrySummarySerializer(entries, many=True).data)

    def post(self, request: Request, warband_id: int) -> Response:
        entry = _in_scope(request.data.get("bestiary_entry_id"), self.warband.campaign_id)
        if not entry:
            return Response({"detail": "Bestiary entry not found"}, status=404)

        WarbandBestiaryFavourite.objects.get_or_create(warband=self.warband, bestiary_entry=entry)
        return Response(status=status.HTTP_201_CREATED)


class WarbandBestiaryFavouriteDeleteView(WarbandScopedView):
    def delete(self, request: Request, warband_id: int, entry_id: int) -> Response:
        # a book id from a list read before the campaign versioned it names the version (CAT-TWEAK-03)
        version = Q(bestiary_entry__replaces_id=entry_id, bestiary_entry__campaign_id=self.warband.campaign_id)
        WarbandBestiaryFavourite.objects.filter(Q(bestiary_entry_id=entry_id) | version, warband=self.warband).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
