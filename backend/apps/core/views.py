from django.db.models import Count, Q
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.in_play import presets
from apps.campaigns.models import CampaignType
from apps.campaigns.serializers.grading import SettingSerializer


class HealthView(APIView):
    """The uptime probe. No authentication, so a stale bearer header never fails it and costs no query; no throttle
    (AUTH-PERF-04)."""

    authentication_classes = ()
    permission_classes = [AllowAny]
    throttle_classes = ()

    def get(self, _request):
        return Response({"status": "ok"})


class KeepAwakeView(HealthView):
    """An alias of health for the keep-awake monitor: GET and HEAD both answer an empty 204, so the monitor works with
    either method (PERF-07, AUTH-PERF-06). No database ping."""

    def get(self, _request):
        return Response(status=204)


class SettingsView(APIView):
    """GET settings/: every setting with its grade, chip order, whether it is always on and how many of the book's
    warband types it holds, and the grade presets ("Up to 1c": the settings it ticks), for the campaign's "Content in
    play" card and campaign creation (grading phase 1). Book data: a login is all it takes. One query."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        book = Q(warband_types__campaign__isnull=True, warband_types__archived_at=None)
        rows = CampaignType.objects.annotate(type_count=Count("warband_types", filter=book))
        settings = list(rows.order_by("sort_order", "name"))
        return Response({"settings": SettingSerializer(settings, many=True).data, "presets": presets(settings)})
