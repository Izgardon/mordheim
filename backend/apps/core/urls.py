from django.urls import path

from .views import HealthView, KeepAwakeView

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("keep-awake/", KeepAwakeView.as_view(), name="keep-awake"),
]
