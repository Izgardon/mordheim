from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


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
