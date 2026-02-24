from django.conf import settings
from django.db import models

from .battle import Battle


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
    TYPE_UNIT_OOA_SET = "unit_ooa_set"
    TYPE_UNIT_OOA_UNSET = "unit_ooa_unset"
    TYPE_UNIT_KILL_RECORDED = "unit_kill_recorded"
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
        (TYPE_UNIT_OOA_SET, "Unit out of action set"),
        (TYPE_UNIT_OOA_UNSET, "Unit out of action unset"),
        (TYPE_UNIT_KILL_RECORDED, "Unit kill recorded"),
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
