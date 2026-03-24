from django.urls import path

from .views import NotificationClearAllView, NotificationClearView, NotificationListView

urlpatterns = [
    path("notifications/", NotificationListView.as_view(), name="notifications-list"),
    path("notifications/clear-all/", NotificationClearAllView.as_view(), name="notifications-clear-all"),
    path("notifications/<int:notification_id>/clear/", NotificationClearView.as_view(), name="notifications-clear"),
]
