from django.urls import path

from .views import PusherAuthView

urlpatterns = [
    path("realtime/pusher/auth/", PusherAuthView.as_view(), name="pusher-auth"),
]
