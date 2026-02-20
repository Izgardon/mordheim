from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .channel_auth import authorize_private_channel
from .services import get_pusher_client


class PusherAuthView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        socket_id = request.data.get("socket_id")
        channel_name = request.data.get("channel_name")

        if not socket_id or not channel_name:
            return Response({"detail": "Missing socket_id or channel_name"}, status=400)

        if not authorize_private_channel(request.user, channel_name):
            return Response({"detail": "Forbidden"}, status=403)

        client = get_pusher_client()
        if not client:
            return Response(
                {"detail": "Pusher not configured"}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        auth = client.authenticate(channel=channel_name, socket_id=socket_id)
        return Response(auth)
