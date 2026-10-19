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
    STATUS_DECLINED = "declined"
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
        (STATUS_DECLINED, "Declined"),
        (STATUS_IN_BATTLE, "In battle"),
        (STATUS_FINISHED_BATTLE, "Finished battle"),
        (STATUS_CONFIRMED_POSTBATTLE, "Confirmed postbattle"),
    )

    # what a player declares when he finishes his own battle (decision 4); "" until then
    DECLARED_WON = "won"
    DECLARED_LOST = "lost"
    DECLARED_UNDECIDED = "undecided"
    DECLARED_RESULT_CHOICES = (
        (DECLARED_WON, "Won"),
        (DECLARED_LOST, "Lost"),
        (DECLARED_UNDECIDED, "Decide when the battle ends"),
    )

    # out of the battle: they don't count towards it and can't follow it (SEC-08)
    LEFT_STATUSES = (STATUS_CANCELED_PREBATTLE, STATUS_DECLINED, STATUS_REPORTED_RESULT_DECLINED)
    ACCEPTED_STATUSES = (STATUS_ACCEPTED, STATUS_JOINED_PREBATTLE, STATUS_READY)

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
    # finished postbattle without applying it: skipped, or closed for him (decision 3)
    skipped_postbattle = models.BooleanField(default=False)
    declared_result = models.CharField(max_length=10, choices=DECLARED_RESULT_CHOICES, blank=True, default="")
    # taken off an ended battle's record by a battle manager (BATL-NEW-04): kept, marked removed
    removed_from_record = models.BooleanField(default=False)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    selected_unit_keys_json = models.JSONField(default=list, blank=True)
    unit_information_json = models.JSONField(default=dict, blank=True)
    custom_units_json = models.JSONField(default=list, blank=True)
    postbattle_json = models.JSONField(default=dict, blank=True)
    # each roster as it stood when the battle started (BUG-73, PERF-38); None until then
    roster_json = models.JSONField(null=True, blank=True)
    declared_rating = models.PositiveIntegerField(null=True, blank=True)
    battle_notes = models.TextField(blank=True, default="")
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
