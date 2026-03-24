from django.conf import settings
from django.db import models


class Notification(models.Model):
    TYPE_TRADE_REQUEST = "trade_request"
    TYPE_BATTLE_INVITE = "battle_invite"
    TYPE_BATTLE_RESULT_REQUEST = "battle_result_request"

    TYPE_CHOICES = [
        (TYPE_TRADE_REQUEST, "Trade request"),
        (TYPE_BATTLE_INVITE, "Battle invite"),
        (TYPE_BATTLE_RESULT_REQUEST, "Battle result request"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    notification_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    campaign_id = models.IntegerField()
    reference_id = models.CharField(max_length=64)
    payload = models.JSONField(default=dict)
    is_resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notification"
        indexes = [
            models.Index(fields=["user", "is_resolved", "created_at"], name="notification_user_resolved_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "notification_type", "reference_id"],
                name="notification_unique_user_type_ref",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user_id}:{self.notification_type}:{self.reference_id}"
