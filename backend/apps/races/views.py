from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.permissions import (
    get_membership,
    get_writable_membership,
    has_campaign_permission,
    parse_campaign_id,
)
from apps.core.catalogue import merge
from apps.core.catalogue.duplicates import refusing_duplicates
from apps.core.catalogue.usage import delete_unless_in_use

from .models import Race
from .serializers import RaceCreateSerializer, RaceSerializer

DUPLICATE = "a race with this name"  # the base constraint (BUG-17)


class RaceListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        races = Race.objects.all()
        campaign_id = parse_campaign_id(request.query_params.get("campaign_id"))
        search = request.query_params.get("search")
        if search:  # before the merge, as every list: the rule hides only exact names, so the rows are the same
            races = races.filter(name__icontains=search.strip())
        if campaign_id is not None:
            membership = get_membership(request.user, campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)
            rows = merge.campaign_rows(races, campaign_id).order_by(*merge.campaign_first("name", "id"))
        else:
            rows = merge.book_rows(races).order_by("name", "id")

        serializer = RaceSerializer(rows, many=True)
        return Response(serializer.data)

    def post(self, request):
        campaign_id = parse_campaign_id(request.data.get("campaign_id"))
        membership = get_writable_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "edit_catalogue"):  # any member could (BUG-82)
            return Response({"detail": "Forbidden"}, status=403)
        serializer = RaceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with refusing_duplicates(DUPLICATE):
            race = serializer.save(campaign_id=campaign_id)
        return Response(RaceSerializer(race).data, status=status.HTTP_201_CREATED)


class RaceDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _get_campaign_race(self, race_id):
        return Race.objects.filter(id=race_id, campaign__isnull=False).first()

    def _update(self, request, race_id, partial):
        race = self._get_campaign_race(race_id)
        if not race:
            return Response({"detail": "Not found"}, status=404)

        campaign_id = request.data.get("campaign_id")
        if campaign_id and str(campaign_id) != str(race.campaign_id):
            return Response({"detail": "Not found"}, status=404)

        membership = get_writable_membership(request.user, race.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "edit_catalogue"):  # it was owners and admins only (BUG-82)
            return Response({"detail": "Forbidden"}, status=403)

        serializer = RaceCreateSerializer(race, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        with refusing_duplicates(DUPLICATE):
            serializer.save()
        return Response(RaceSerializer(race).data)

    def put(self, request, race_id):
        return self._update(request, race_id, partial=False)

    def patch(self, request, race_id):
        return self._update(request, race_id, partial=True)

    def delete(self, request, race_id):
        race = self._get_campaign_race(race_id)  # a book race is "Not found" here, as for edits
        if not race:
            return Response({"detail": "Not found"}, status=404)

        membership = get_writable_membership(request.user, race.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "delete_catalogue"):
            return Response({"detail": "Forbidden"}, status=403)

        delete_unless_in_use(race, "race")  # 409 in_use while any unit is of it (BUG-130)
        return Response(status=status.HTTP_204_NO_CONTENT)
