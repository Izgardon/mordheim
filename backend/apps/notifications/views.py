from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .selectors import listed, serialize


class NotificationListView(APIView):
    """GET: the caller's notifications that can still be answered, newest first."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response([serialize(notification) for notification in listed(request.user)])


class NotificationClearView(APIView):
    """POST: clear one notification (a pending trade request is declined)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, notification_id):
        if not services.clear(request.user, notification_id):
            return Response({"detail": "Not found"}, status=404)
        return Response({"ok": True})


class NotificationClearAllView(APIView):
    """POST: clear the caller's notifications that can no longer be answered; nothing is declined, and what still
    needs an answer stays (CAMP-TWEAK-10). Answers `{"ok": true, "cleared": n, "kept": m}`."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        return Response({"ok": True, **services.clear_all(request.user)})
