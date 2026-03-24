from django.utils import timezone

from .models import Notification


def create_notification(
    user_id: int,
    notification_type: str,
    reference_id: str,
    campaign_id: int,
    payload: dict,
) -> Notification:
    notification, _ = Notification.objects.update_or_create(
        user_id=user_id,
        notification_type=notification_type,
        reference_id=reference_id,
        defaults={
            "campaign_id": campaign_id,
            "payload": payload,
            "is_resolved": False,
            "resolved_at": None,
        },
    )
    return notification


def resolve_notification(user_id: int, notification_type: str, reference_id: str) -> None:
    Notification.objects.filter(
        user_id=user_id,
        notification_type=notification_type,
        reference_id=reference_id,
        is_resolved=False,
    ).update(is_resolved=True, resolved_at=timezone.now())


def resolve_notifications_for_reference(notification_type: str, reference_id: str) -> None:
    """Resolve all unresolved notifications for all users for a given reference."""
    Notification.objects.filter(
        notification_type=notification_type,
        reference_id=reference_id,
        is_resolved=False,
    ).update(is_resolved=True, resolved_at=timezone.now())
