from django.db import models

from .shared import RosterUnit, stat_constraints
from .warband import Warband


class HenchmenGroup(RosterUnit):
    warband = models.ForeignKey(Warband, related_name="henchmen_groups", on_delete=models.CASCADE)
    race = models.ForeignKey(
        "races.Race",
        related_name="henchmen_groups",
        on_delete=models.RESTRICT,  # a race in use can't be deleted (BUG-130)
        null=True,
        blank=True,
    )
    max_size = models.PositiveIntegerField(default=5)
    no_level_ups = models.BooleanField(default=False)
    # Lad's got talent warns, and still promotes, when his rules say the group can't be promoted (Zombies)
    promotable = models.BooleanField(default=True)
    # the template fighter it was recruited as ("warriors"; the templates plan, phase 2); blank: added by hand
    fighter_key = models.SlugField(max_length=80, blank=True, default="")
    # the creature the group was recruited from (units/services/beasts.py): joining needs the same beast, and its
    # Animal item is what a member turns back into; held with RESTRICT, so the beast is archived, not deleted
    source_beast = models.ForeignKey(
        "bestiary.BestiaryEntry", related_name="henchmen_groups", on_delete=models.RESTRICT, null=True, blank=True
    )

    items: models.ManyToManyField = models.ManyToManyField(
        "items.Item",
        through="HenchmenGroupItem",
        related_name="henchmen_groups",
        blank=True,
    )
    skills: models.ManyToManyField = models.ManyToManyField(
        "skills.Skill",
        through="HenchmenGroupSkill",
        related_name="henchmen_groups",
        blank=True,
    )
    specials: models.ManyToManyField = models.ManyToManyField(
        "special.Special",
        through="HenchmenGroupSpecial",
        related_name="henchmen_groups",
        blank=True,
    )

    class Meta:
        db_table = "henchmen_group"
        constraints = stat_constraints("henchmen_group")

    def __str__(self):
        return f"{self.name} ({self.warband_id})"


class Henchman(models.Model):
    group = models.ForeignKey(HenchmenGroup, related_name="henchmen", on_delete=models.CASCADE)
    name = models.CharField(max_length=120)
    kills = models.PositiveIntegerField(default=0)
    dead = models.BooleanField(default=False)
    dismissed_at = models.DateTimeField(null=True, blank=True)  # left out of a group save: kept as a record

    class Meta:
        db_table = "henchman"

    def __str__(self):
        return f"{self.name} ({self.group_id})"


class HenchmenGroupItem(models.Model):
    """One line of a group's loadout: what every member carries, one copy each (henchmen loadouts). A member who lacks
    it has a gap (`HenchmanItemGap`); the copies a row stands for are its living members less those gaps."""

    henchmen_group = models.ForeignKey(HenchmenGroup, related_name="henchmen_group_items", on_delete=models.CASCADE)
    item = models.ForeignKey("items.Item", related_name="henchmen_group_items", on_delete=models.RESTRICT)
    cost = models.PositiveIntegerField(null=True, blank=True)  # what one copy cost (each)
    companion = models.BooleanField(
        default=False
    )  # a mount the group rides, or a pet switched on (units/companions.py)

    class Meta:
        db_table = "henchmen_group_item"
        # Postgres may hand back an unordered read in any order, so a group's kit rendered differently between
        # loads and test_roster_promote failed at random on the order of two rows. loadouts.py and members.py
        # already order by id; this makes every other read agree with them.
        ordering = ["id"]

    def __str__(self):
        return f"{self.henchmen_group_id}:{self.item_id}"


class HenchmanItemGap(models.Model):
    """A member of a group who lacks one line of its loadout: his horse died, he used it up, his kit went to the stash,
    or he joined (or the line was equipped) without one. A warning on the member, never a block; in battle he starts
    without it. `left`: the player chose to leave it so ("Leave it")."""

    SHORT, LOST, USED, KIT_TAKEN = "short", "lost", "used", "kit_taken"
    REASONS = (
        (SHORT, "Joined or equipped without it"),
        (LOST, "Lost after a battle"),
        (USED, "Used up in a battle"),
        (KIT_TAKEN, "Kit taken to the stash"),
    )

    henchman = models.ForeignKey(Henchman, related_name="item_gaps", on_delete=models.CASCADE)
    group_item = models.ForeignKey(HenchmenGroupItem, related_name="gaps", on_delete=models.CASCADE)
    reason = models.CharField(max_length=12, choices=REASONS, default=SHORT)
    left = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "henchman_item_gap"
        constraints = [models.UniqueConstraint(fields=["henchman", "group_item"], name="unique_henchman_item_gap")]

    def __str__(self):
        return f"{self.henchman_id} lacks {self.group_item_id}"


class HenchmenGroupSkill(models.Model):
    henchmen_group = models.ForeignKey(HenchmenGroup, related_name="henchmen_group_skills", on_delete=models.CASCADE)
    skill = models.ForeignKey("skills.Skill", related_name="henchmen_group_skills", on_delete=models.RESTRICT)

    class Meta:
        db_table = "henchmen_group_skill"

    def __str__(self):
        return f"{self.henchmen_group_id}:{self.skill_id}"


class HenchmenGroupSpecial(models.Model):
    henchmen_group = models.ForeignKey(HenchmenGroup, related_name="henchmen_group_specials", on_delete=models.CASCADE)
    special = models.ForeignKey("special.Special", related_name="henchmen_group_specials", on_delete=models.RESTRICT)

    class Meta:
        db_table = "henchmen_group_special"

    def __str__(self):
        return f"{self.henchmen_group_id}:{self.special_id}"
