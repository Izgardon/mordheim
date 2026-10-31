"""A kill (next step 9): one row per kill, written in the same transaction as its `unit_kill_recorded` event.

The event stays the feed and the undo log, its payload as before; everything that counts or reads kills reads this
table. The killer is always one of a warband's own units in the battle: a hero, a henchman (with his group) or a hired
sword (dramatis personae among them), never a temporary unit, a pet or a creature. The victim is a unit of a warband,
or a victim that isn't a row (a temporary unit or a pet, a neutral creature, someone named by hand), kept as columns
only. Exactly the unit keys matching each kind are set (check constraints); they are SET_NULL, so a kill outlives the
unit's row with the names and traits saved at the time. Undo sets `voided_at`: the row stays, and nothing counts it.
"""

from typing import Any

from django.db import models
from django.db.models import Q
from django.utils import timezone

from .battle import Battle
from .event import BattleEvent

HERO, HENCHMAN, HIRELING = "hero", "henchman", "hireling"
TEMPORARY, CREATURE, SOMEONE_ELSE = "temporary", "creature", "someone_else"
KILLER_KINDS = (HERO, HENCHMAN, HIRELING)
VICTIM_KINDS = (HERO, HENCHMAN, HIRELING, TEMPORARY, CREATURE, SOMEONE_ELSE)
UNKEYED_VICTIMS = (TEMPORARY, CREATURE, SOMEONE_ELSE)  # victims that aren't rows
KEYED_VICTIMS = (TEMPORARY, CREATURE)  # a battle-scoped key, so undo can stand the victim back up
FIGHT, AFTER = "fight", "after"
HOWS = ("melee", "shooting", "magic", "other")
CASTERS = ("Wizard", "Priest")


def _unit_keys(prefix: str, kinds: tuple[str, ...]) -> Q:
    """Exactly the unit keys matching the kind may be set (they may be null after the unit's row is deleted)."""
    kind, hero, henchman = f"{prefix}_kind", f"{prefix}_hero__isnull", f"{prefix}_henchman__isnull"
    group, hireling = f"{prefix}_group__isnull", f"{prefix}_hireling__isnull"
    rows = (
        Q(**{kind: HERO, henchman: True, group: True, hireling: True})
        | Q(**{kind: HENCHMAN, hero: True, hireling: True})
        | Q(**{kind: HIRELING, hero: True, henchman: True, group: True})
    )
    unkeyed = [entry for entry in kinds if entry in UNKEYED_VICTIMS]
    if unkeyed:
        rows |= Q(**{f"{kind}__in": unkeyed, hero: True, henchman: True, group: True, hireling: True})
    return rows


def _unit(model: str, related_name: str) -> "models.ForeignKey[Any, Any]":
    return models.ForeignKey(model, related_name=related_name, on_delete=models.SET_NULL, null=True, blank=True)


class BattleKill(models.Model):
    battle = models.ForeignKey(Battle, related_name="kills", on_delete=models.CASCADE)
    campaign = models.ForeignKey("campaigns.Campaign", related_name="battle_kills", on_delete=models.CASCADE)
    event = models.OneToOneField(BattleEvent, related_name="kill", on_delete=models.CASCADE)
    round = models.PositiveSmallIntegerField(null=True, blank=True)  # null when logged after the fight
    phase = models.CharField(max_length=8, choices=[(FIGHT, "In the fight"), (AFTER, "After the fight")])
    how = models.CharField(max_length=10, choices=[(how, how.title()) for how in HOWS], null=True, blank=True)
    earns_xp = models.BooleanField(default=True)
    took_out_victim = models.BooleanField(default=False)  # the kill put its victim out of action (undo puts him back)
    voided_at = models.DateTimeField(null=True, blank=True)  # undone: kept, counted nowhere
    created_at = models.DateTimeField(default=timezone.now)

    killer_warband = models.ForeignKey("warbands.Warband", related_name="kills_scored", on_delete=models.CASCADE)
    killer_kind = models.CharField(max_length=10, choices=[(kind, kind) for kind in KILLER_KINDS])
    killer_hero = _unit("warbands.Hero", "kills_scored")
    killer_henchman = _unit("warbands.Henchman", "kills_scored")
    killer_group = _unit("warbands.HenchmenGroup", "kills_scored")
    killer_hireling = _unit("warbands.Hireling", "kills_scored")
    killer_name = models.CharField(max_length=120, blank=True)
    killer_type = models.CharField(max_length=120, blank=True)  # "Youngblood": a nameless killer can still be told
    killer_leader = models.BooleanField(default=False)  # the warband's leader at the time (There can be only one)

    victim_kind = models.CharField(max_length=12, choices=[(kind, kind) for kind in VICTIM_KINDS])
    victim_warband = _unit("warbands.Warband", "kills_suffered")  # null for a creature or someone else
    victim_hero = _unit("warbands.Hero", "kills_suffered")
    victim_henchman = _unit("warbands.Henchman", "kills_suffered")
    victim_group = _unit("warbands.HenchmenGroup", "kills_suffered")
    victim_hireling = _unit("warbands.Hireling", "kills_suffered")
    victim_name = models.CharField(max_length=120, blank=True)
    victim_type = models.CharField(max_length=120, blank=True)
    victim_key = models.TextField(null=True, blank=True)  # a temporary unit's or creature's key in the battle
    victim_leader = models.BooleanField(default=False)
    victim_large = models.BooleanField(default=False)
    victim_caster = models.CharField(max_length=8, blank=True, default="")  # "", "Wizard" or "Priest"

    class Meta:
        db_table = "battle_kill"
        indexes = [models.Index(fields=["campaign", "created_at"], name="battle_kill_camp_created_idx")]
        constraints = [
            models.CheckConstraint(check=_unit_keys("killer", KILLER_KINDS), name="battle_kill_killer_keys"),
            models.CheckConstraint(check=_unit_keys("victim", VICTIM_KINDS), name="battle_kill_victim_keys"),
            models.CheckConstraint(
                check=~Q(victim_kind__in=(CREATURE, SOMEONE_ELSE)) | Q(victim_warband__isnull=True),
                name="battle_kill_victim_warband",
            ),
            models.CheckConstraint(
                check=Q(victim_kind__in=KEYED_VICTIMS, victim_key__isnull=False)
                | (~Q(victim_kind__in=KEYED_VICTIMS) & Q(victim_key__isnull=True)),
                name="battle_kill_victim_key",
            ),
            models.CheckConstraint(check=Q(phase__in=(FIGHT, AFTER)), name="battle_kill_phase"),
            models.CheckConstraint(check=Q(phase=FIGHT) | Q(round__isnull=True), name="battle_kill_after_no_round"),
            models.CheckConstraint(check=Q(how__isnull=True) | Q(how__in=HOWS), name="battle_kill_how"),
            models.CheckConstraint(check=Q(victim_caster__in=("", *CASTERS)), name="battle_kill_victim_caster"),
        ]

    def __str__(self):
        return f"{self.battle_id}:{self.id}:{self.killer_name} took {self.victim_name}"

    @property
    def killer_unit_key(self) -> str | None:
        """The killer's unit key in the battle ("hero:12", "henchman:88"), None once his row is gone."""
        unit_id = {HERO: self.killer_hero_id, HENCHMAN: self.killer_henchman_id, HIRELING: self.killer_hireling_id}
        found = unit_id.get(self.killer_kind)
        return f"{self.killer_kind}:{found}" if found else None

    @property
    def victim_unit_key(self) -> str | None:
        """The victim's unit key in the battle: a row's ("hero:12"), a temporary unit's or creature's own key."""
        if self.victim_kind in KEYED_VICTIMS:
            return self.victim_key
        unit_id = {HERO: self.victim_hero_id, HENCHMAN: self.victim_henchman_id, HIRELING: self.victim_hireling_id}
        found = unit_id.get(self.victim_kind)
        return f"{self.victim_kind}:{found}" if found else None

    def killer_called(self, *, start: bool = False) -> str:
        """The killer as a line names him: his name, else "a <type>" ("A Youngblood" to start a sentence)."""
        return called(self.killer_name, self.killer_type, start=start)

    def victim_called(self, *, start: bool = False) -> str:
        return called(self.victim_name, self.victim_type, start=start)


def called(name: str, unit_type: str, *, start: bool = False) -> str:
    """A unit as a line names him: his name, else "a <type>", else "someone"."""
    if name:
        return name
    phrase = f"a {unit_type}" if unit_type else "someone"
    return phrase[:1].upper() + phrase[1:] if start else phrase
