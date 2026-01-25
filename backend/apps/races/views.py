from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.permissions import get_membership, has_campaign_permission

from .models import Race
from .serializers import RaceCreateSerializer, RaceSerializer


class RaceListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        races = Race.objects.all()
        campaign_id = request.query_params.get("campaign_id")
        if campaign_id:
            membership = get_membership(request.user, campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

            custom_races = races.filter(campaign_id=campaign_id)
            base_races = races.filter(campaign__isnull=True)
            if custom_races.exists():
                base_races = base_races.exclude(
                    name__in=custom_races.values_list("name", flat=True)
                )
            races = list(custom_races.order_by("name", "id")) + list(
                base_races.order_by("name", "id")
            )
        else:
            races = races.filter(campaign__isnull=True).order_by("name", "id")

        search = request.query_params.get("search")
        if search:
            if isinstance(races, list):
                cleaned = search.strip().lower()
                races = [race for race in races if cleaned in race.name.lower()]
            else:
                races = races.filter(name__icontains=search.strip())

        serializer = RaceSerializer(races, many=True)
        return Response(serializer.data)

    def post(self, request):
        campaign_id = request.data.get("campaign_id")
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_races"):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        serializer = RaceCreateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
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

        membership = get_membership(request.user, race.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_races"):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        serializer = RaceCreateSerializer(race, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(RaceSerializer(race).data)

    def put(self, request, race_id):
        return self._update(request, race_id, partial=False)

    def patch(self, request, race_id):
        return self._update(request, race_id, partial=True)
