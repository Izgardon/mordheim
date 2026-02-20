import uuid

from django.conf import settings
from django.db import models


class TradeRequest(models.Model):
    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_DECLINED = "declined"
    STATUS_EXPIRED = "expired"
    STATUS_COMPLETED = "completed"

    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_DECLINED, "Declined"),
        (STATUS_EXPIRED, "Expired"),
        (STATUS_COMPLETED, "Completed"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        on_delete=models.CASCADE,
        related_name="trade_requests",
    )
    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="trade_requests_sent",
    )
    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="trade_requests_received",
    )
    from_warband = models.ForeignKey(
        "warbands.Warband",
        on_delete=models.CASCADE,
        related_name="trade_requests_sent",
    )
    to_warband = models.ForeignKey(
        "warbands.Warband",
        on_delete=models.CASCADE,
        related_name="trade_requests_received",
    )
    status = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
    )
    from_offer = models.JSONField(default=dict, blank=True)
    to_offer = models.JSONField(default=dict, blank=True)
    from_accepted = models.BooleanField(default=False)
    to_accepted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = "trade_request"
        indexes = [
            models.Index(fields=["campaign", "status"]),
            models.Index(fields=["to_user", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.campaign_id}:{self.from_user_id}->{self.to_user_id} ({self.status})"
