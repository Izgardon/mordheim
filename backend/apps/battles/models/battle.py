from django.conf import settings
from django.db import models


class Battle(models.Model):
    FLOW_TYPE_NORMAL = "normal"
    FLOW_TYPE_REPORTED_RESULT = "reported_result"
    FLOW_TYPE_CHOICES = (
        (FLOW_TYPE_NORMAL, "Normal"),
        (FLOW_TYPE_REPORTED_RESULT, "Reported result"),
    )

    STATUS_INVITING = "inviting"
    STATUS_REPORTED_RESULT_PENDING = "reported_result_pending"
    STATUS_PREBATTLE = "prebattle"
    STATUS_ACTIVE = "active"
    STATUS_POSTBATTLE = "postbattle"
    STATUS_ENDED = "ended"
    STATUS_CANCELED = "canceled"

    STATUS_CHOICES = (
        (STATUS_INVITING, "Inviting"),
        (STATUS_REPORTED_RESULT_PENDING, "Reported result pending"),
        (STATUS_PREBATTLE, "Prebattle"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_POSTBATTLE, "Postbattle"),
        (STATUS_ENDED, "Ended"),
        (STATUS_CANCELED, "Canceled"),
    )

    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="battles",
        on_delete=models.CASCADE,
    )
    created_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="battles_created",
        on_delete=models.CASCADE,
    )
    winner_warband_ids_json = models.JSONField(default=list, blank=True)
    flow_type = models.CharField(
        max_length=20,
        choices=FLOW_TYPE_CHOICES,
        default=FLOW_TYPE_NORMAL,
    )
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default=STATUS_INVITING,
    )
    scenario = models.CharField(max_length=120)
    settings_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    post_processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "battle"
        constraints = [
            models.CheckConstraint(
                check=~models.Q(scenario=""),
                name="battle_scenario_not_empty",
            ),
        ]
        indexes = [
            models.Index(fields=["campaign", "status"]),
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self):
        return f"{self.campaign_id}:{self.id} ({self.status})"
