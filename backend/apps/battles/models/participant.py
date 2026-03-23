from django.conf import settings
from django.db import models

from .battle import Battle


class BattleParticipant(models.Model):
    STATUS_INVITED = "invited"
    STATUS_ACCEPTED = "accepted"
    STATUS_REPORTED_RESULT_PENDING = "reported_result_pending"
    STATUS_REPORTED_RESULT_APPROVED = "reported_result_approved"
    STATUS_REPORTED_RESULT_DECLINED = "reported_result_declined"
    STATUS_JOINED_PREBATTLE = "joined_prebattle"
    STATUS_READY = "ready"
    STATUS_CANCELED_PREBATTLE = "canceled_prebattle"
    STATUS_IN_BATTLE = "in_battle"
    STATUS_FINISHED_BATTLE = "finished_battle"
    STATUS_CONFIRMED_POSTBATTLE = "confirmed_postbattle"

    STATUS_CHOICES = (
        (STATUS_INVITED, "Invited"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_REPORTED_RESULT_PENDING, "Reported result pending"),
        (STATUS_REPORTED_RESULT_APPROVED, "Reported result approved"),
        (STATUS_REPORTED_RESULT_DECLINED, "Reported result declined"),
        (STATUS_JOINED_PREBATTLE, "Joined prebattle"),
        (STATUS_READY, "Ready"),
        (STATUS_CANCELED_PREBATTLE, "Canceled prebattle"),
        (STATUS_IN_BATTLE, "In battle"),
        (STATUS_FINISHED_BATTLE, "Finished battle"),
        (STATUS_CONFIRMED_POSTBATTLE, "Confirmed postbattle"),
    )

    CONNECTION_ONLINE = "online"
    CONNECTION_OFFLINE = "offline"
    CONNECTION_CHOICES = (
        (CONNECTION_ONLINE, "Online"),
        (CONNECTION_OFFLINE, "Offline"),
    )

    battle = models.ForeignKey(
        Battle,
        related_name="participants",
        on_delete=models.CASCADE,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="battle_participations",
        on_delete=models.CASCADE,
    )
    warband = models.ForeignKey(
        "warbands.Warband",
        related_name="battle_participations",
        on_delete=models.CASCADE,
    )
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default=STATUS_INVITED,
    )
    connection_state = models.CharField(
        max_length=10,
        choices=CONNECTION_CHOICES,
        default=CONNECTION_OFFLINE,
    )
    invited_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="battle_participant_invites",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    invited_at = models.DateTimeField(null=True, blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    joined_at = models.DateTimeField(null=True, blank=True)
    ready_at = models.DateTimeField(null=True, blank=True)
    canceled_at = models.DateTimeField(null=True, blank=True)
    battle_joined_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    last_event_id = models.BigIntegerField(default=0)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    selected_unit_keys_json = models.JSONField(default=list, blank=True)
    stat_overrides_json = models.JSONField(default=dict, blank=True)
    unit_information_json = models.JSONField(default=dict, blank=True)
    custom_units_json = models.JSONField(default=list, blank=True)
    postbattle_json = models.JSONField(default=dict, blank=True)
    declared_rating = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "battle_participant"
        constraints = [
            models.UniqueConstraint(
                fields=["battle", "user"],
                name="unique_battle_participant_user",
            ),
            models.UniqueConstraint(
                fields=["battle", "warband"],
                name="unique_battle_participant_warband",
            ),
        ]
        indexes = [
            models.Index(fields=["battle", "status"]),
            models.Index(fields=["user", "status"]),
        ]

    def __str__(self):
        return f"{self.battle_id}:{self.user_id}:{self.status}"
