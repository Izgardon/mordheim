from django.conf import settings
from django.db import models


class Battle(models.Model):
    STATUS_INVITING = "inviting"
    STATUS_PREBATTLE = "prebattle"
    STATUS_ACTIVE = "active"
    STATUS_POSTBATTLE = "postbattle"
    STATUS_ENDED = "ended"
    STATUS_CANCELED = "canceled"

    STATUS_CHOICES = (
        (STATUS_INVITING, "Inviting"),
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
    title = models.CharField(max_length=160, default="", blank=True)
    winner_warband = models.ForeignKey(
        "warbands.Warband",
        related_name="battles_won",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=20,
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


class BattleParticipant(models.Model):
    STATUS_INVITED = "invited"
    STATUS_ACCEPTED = "accepted"
    STATUS_JOINED_PREBATTLE = "joined_prebattle"
    STATUS_READY = "ready"
    STATUS_CANCELED_PREBATTLE = "canceled_prebattle"
    STATUS_IN_BATTLE = "in_battle"
    STATUS_FINISHED_BATTLE = "finished_battle"
    STATUS_CONFIRMED_POSTBATTLE = "confirmed_postbattle"

    STATUS_CHOICES = (
        (STATUS_INVITED, "Invited"),
        (STATUS_ACCEPTED, "Accepted"),
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
    custom_units_json = models.JSONField(default=list, blank=True)
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


class BattleEvent(models.Model):
    TYPE_BATTLE_CREATED = "battle_created"
    TYPE_PARTICIPANT_INVITED = "participant_invited"
    TYPE_PARTICIPANT_ACCEPTED = "participant_accepted"
    TYPE_PARTICIPANT_JOINED_PREBATTLE = "participant_joined_prebattle"
    TYPE_PARTICIPANT_READY_SET = "participant_ready_set"
    TYPE_PARTICIPANT_READY_UNSET = "participant_ready_unset"
    TYPE_PARTICIPANT_CANCELED_PREBATTLE = "participant_canceled_prebattle"
    TYPE_PARTICIPANT_REJOINED = "participant_rejoined"
    TYPE_BATTLE_STARTED = "battle_started"
    TYPE_BATTLE_PREBATTLE_OPENED = "battle_prebattle_opened"
    TYPE_PARTICIPANT_JOINED_BATTLE = "participant_joined_battle"
    TYPE_KILL_RECORDED = "kill_recorded"
    TYPE_DEATH_RECORDED = "death_recorded"
    TYPE_ITEM_USED = "item_used"
    TYPE_PARTICIPANT_FINISHED_BATTLE = "participant_finished_battle"
    TYPE_BATTLE_ENTERED_POSTBATTLE = "battle_entered_postbattle"
    TYPE_WINNER_DECLARED = "winner_declared"
    TYPE_PARTICIPANT_CONFIRMED_POSTBATTLE = "participant_confirmed_postbattle"
    TYPE_BATTLE_ENDED = "battle_ended"
    TYPE_BATTLE_CANCELED = "battle_canceled"

    TYPE_CHOICES = (
        (TYPE_BATTLE_CREATED, "Battle created"),
        (TYPE_PARTICIPANT_INVITED, "Participant invited"),
        (TYPE_PARTICIPANT_ACCEPTED, "Participant accepted"),
        (TYPE_PARTICIPANT_JOINED_PREBATTLE, "Participant joined prebattle"),
        (TYPE_PARTICIPANT_READY_SET, "Participant ready set"),
        (TYPE_PARTICIPANT_READY_UNSET, "Participant ready unset"),
        (TYPE_PARTICIPANT_CANCELED_PREBATTLE, "Participant canceled prebattle"),
        (TYPE_PARTICIPANT_REJOINED, "Participant rejoined"),
        (TYPE_BATTLE_STARTED, "Battle started"),
        (TYPE_BATTLE_PREBATTLE_OPENED, "Battle prebattle opened"),
        (TYPE_PARTICIPANT_JOINED_BATTLE, "Participant joined battle"),
        (TYPE_KILL_RECORDED, "Kill recorded"),
        (TYPE_DEATH_RECORDED, "Death recorded"),
        (TYPE_ITEM_USED, "Item used"),
        (TYPE_PARTICIPANT_FINISHED_BATTLE, "Participant finished battle"),
        (TYPE_BATTLE_ENTERED_POSTBATTLE, "Battle entered postbattle"),
        (TYPE_WINNER_DECLARED, "Winner declared"),
        (TYPE_PARTICIPANT_CONFIRMED_POSTBATTLE, "Participant confirmed postbattle"),
        (TYPE_BATTLE_ENDED, "Battle ended"),
        (TYPE_BATTLE_CANCELED, "Battle canceled"),
    )

    battle = models.ForeignKey(
        Battle,
        related_name="events",
        on_delete=models.CASCADE,
    )
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="battle_events",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    type = models.CharField(max_length=64, choices=TYPE_CHOICES)
    payload_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "battle_event"
        indexes = [
            models.Index(fields=["battle", "id"]),
            models.Index(fields=["battle", "type"]),
        ]

    def __str__(self):
        return f"{self.battle_id}:{self.id}:{self.type}"
