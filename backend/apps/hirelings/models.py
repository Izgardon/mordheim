"""The hireling catalogue: hired swords and dramatis personae, each a catalogue kind of its own (the bestiary rewrite,
step 2).

Both carry the same columns (`HirelingProfile`) and the same five link tables: skills, specials, spells, items (with
a quantity: the Ogre keeps both swords) and restrictions (with a note). A dramatis persona adds how long it stays and
what it is paid in; it gains no XP and uses the Hero injury table, which come from its kind, not from columns.
Hiring copies a row onto the warband as a `warbands.Hireling` that keeps no link back.

The links name the same relations on both kinds (`skill_links`, `special_links`, `spell_links`, `item_links`,
`restriction_links`), so serializers, writes, seeding and hiring are written once for both. Each link to a skill,
special, spell or item holds it with RESTRICT, as units' copies do (BUG-16): the catalogue archives an entry a hired
sword still lists instead of deleting it.
"""

from django.db import models

from apps.core.models import CatalogueEntry, version_constraints
from apps.warbands.models.shared import StatBlock, stat_constraints

CASTERS = (("No", "No"), ("Wizard", "Wizard"), ("Priest", "Priest"))
STAYS = (("always", "Always"), ("one_battle", "One battle"))


def _owner(model: str, related: str) -> models.ForeignKey:
    """A link's hired sword or dramatis persona: the links go with it."""
    return models.ForeignKey(model, related_name=related, on_delete=models.CASCADE)


def _held(model: str, related: str) -> models.ForeignKey:
    """The skill, special, spell or item a link holds: an entry in use can't be deleted (BUG-16)."""
    return models.ForeignKey(model, related_name=related, on_delete=models.RESTRICT)


class HirelingProfile(StatBlock, CatalogueEntry):
    """What a hired sword and a dramatis persona both carry.

    `description` is fluff: shown in the catalogue, never copied on hire. `race_label` keeps the source's race text
    (e.g. "Chameleon Skink") whether or not `race` found a match. The costs keep their formulas beside the numbers
    ("70+3D6" with 70, "1 piece of wyrdstone" with no number). `grade` is text until the grading plan swaps it for a
    foreign key.
    """

    name = models.CharField(max_length=160)
    description = models.TextField(max_length=4000, blank=True, default="")
    armour_save = models.SmallIntegerField(null=True, blank=True)
    large = models.BooleanField(default=False)
    caster = models.CharField(max_length=20, default="No", choices=CASTERS)
    race_label = models.CharField(max_length=60, blank=True, default="")
    hire_cost = models.PositiveIntegerField(null=True, blank=True)
    hire_cost_expression = models.CharField(max_length=120, blank=True, default="")
    upkeep_cost = models.PositiveIntegerField(null=True, blank=True)
    upkeep_cost_expression = models.CharField(max_length=120, blank=True, default="")
    rating = models.PositiveIntegerField(null=True, blank=True)
    available_skill_types = models.JSONField(default=list, blank=True)
    grade = models.CharField(max_length=20, blank=True, default="")

    class Meta:
        abstract = True


def profile_constraints(prefix: str) -> list[models.BaseConstraint]:
    """The stat ranges, one version per book entry in a campaign, and one entry per name in the book, an add-on and a
    campaign (NULLs not distinct, as the seeders upsert: BUG-17)."""
    return [
        *stat_constraints(prefix),
        *version_constraints(prefix),
        models.UniqueConstraint(
            fields=["campaign", "campaign_type", "name"], name=f"{prefix}_unique_name", nulls_distinct=False
        ),
    ]


class HiredSword(HirelingProfile):
    campaign = models.ForeignKey(  # null: the book
        "campaigns.Campaign", related_name="hired_swords", null=True, blank=True, on_delete=models.CASCADE
    )
    campaign_type = models.ForeignKey(  # an add-on's entry (CAT-NEW-04: schema only, always null today)
        "campaigns.CampaignType", related_name="hired_swords", null=True, blank=True, on_delete=models.RESTRICT
    )
    race = models.ForeignKey(  # RESTRICT, as units hold theirs (BUG-130)
        "races.Race", related_name="hired_swords", null=True, blank=True, on_delete=models.RESTRICT
    )

    class Meta:
        db_table = "hired_sword"
        ordering = ["name"]
        constraints = profile_constraints("hired_sword")

    def __str__(self):
        return f"{self.name} (hired sword)"


class DramatisPersona(HirelingProfile):
    """A unique character found after a battle: `stays` for good or for one battle, paid in what `payment_note`
    says ("25 gc or 1 shard", a summoning, a favour)."""

    campaign = models.ForeignKey(  # null: the book
        "campaigns.Campaign", related_name="dramatis_personae", null=True, blank=True, on_delete=models.CASCADE
    )
    campaign_type = models.ForeignKey(  # an add-on's entry (CAT-NEW-04: schema only, always null today)
        "campaigns.CampaignType", related_name="dramatis_personae", null=True, blank=True, on_delete=models.RESTRICT
    )
    race = models.ForeignKey(  # RESTRICT, as units hold theirs (BUG-130)
        "races.Race", related_name="dramatis_personae", null=True, blank=True, on_delete=models.RESTRICT
    )
    stays = models.CharField(max_length=20, choices=STAYS, default="always")
    payment_note = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        db_table = "dramatis_persona"
        ordering = ["name"]
        verbose_name_plural = "dramatis personae"
        constraints = profile_constraints("dramatis_persona")

    def __str__(self):
        return f"{self.name} (dramatis persona)"


class Link(models.Model):
    """A link row: its hired sword or dramatis persona, and what it links."""

    class Meta:
        abstract = True

    def __str__(self):
        ids = (getattr(self, field.attname) for field in self._meta.concrete_fields if field.is_relation)
        return ":".join(map(str, ids))  # "<hired sword id>:<skill id>"


class ItemLink(Link):
    quantity = models.PositiveIntegerField(default=1)  # the Ogre's two swords are one link of 2

    class Meta:
        abstract = True


class RestrictionLink(Link):
    additional_note = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        abstract = True


class HiredSwordSkill(Link):
    hired_sword = _owner("HiredSword", "skill_links")
    skill = _held("skills.Skill", "hired_sword_skills")

    class Meta:
        db_table = "hired_sword_skill"


class HiredSwordSpecial(Link):
    hired_sword = _owner("HiredSword", "special_links")
    special = _held("special.Special", "hired_sword_specials")

    class Meta:
        db_table = "hired_sword_special"


class HiredSwordSpell(Link):
    hired_sword = _owner("HiredSword", "spell_links")
    spell = _held("spells.Spell", "hired_sword_spells")

    class Meta:
        db_table = "hired_sword_spell"


class HiredSwordItem(ItemLink):
    hired_sword = _owner("HiredSword", "item_links")
    item = _held("items.Item", "hired_sword_items")

    class Meta:
        db_table = "hired_sword_item"
        constraints = [models.UniqueConstraint(fields=["hired_sword", "item"], name="hired_sword_item_once")]


class HiredSwordRestriction(RestrictionLink):
    hired_sword = _owner("HiredSword", "restriction_links")
    restriction = models.ForeignKey(
        "restrictions.Restriction", related_name="hired_sword_links", on_delete=models.CASCADE
    )

    class Meta:
        db_table = "hired_sword_restriction"
        constraints = [
            models.UniqueConstraint(
                fields=["hired_sword", "restriction", "additional_note"], name="hired_sword_restriction_once"
            )
        ]


class DramatisPersonaSkill(Link):
    dramatis_persona = _owner("DramatisPersona", "skill_links")
    skill = _held("skills.Skill", "dramatis_persona_skills")

    class Meta:
        db_table = "dramatis_persona_skill"


class DramatisPersonaSpecial(Link):
    dramatis_persona = _owner("DramatisPersona", "special_links")
    special = _held("special.Special", "dramatis_persona_specials")

    class Meta:
        db_table = "dramatis_persona_special"


class DramatisPersonaSpell(Link):
    dramatis_persona = _owner("DramatisPersona", "spell_links")
    spell = _held("spells.Spell", "dramatis_persona_spells")

    class Meta:
        db_table = "dramatis_persona_spell"


class DramatisPersonaItem(ItemLink):
    dramatis_persona = _owner("DramatisPersona", "item_links")
    item = _held("items.Item", "dramatis_persona_items")

    class Meta:
        db_table = "dramatis_persona_item"
        constraints = [models.UniqueConstraint(fields=["dramatis_persona", "item"], name="dramatis_persona_item_once")]


class DramatisPersonaRestriction(RestrictionLink):
    dramatis_persona = _owner("DramatisPersona", "restriction_links")
    restriction = models.ForeignKey(
        "restrictions.Restriction", related_name="dramatis_persona_links", on_delete=models.CASCADE
    )

    class Meta:
        db_table = "dramatis_persona_restriction"
        constraints = [
            models.UniqueConstraint(
                fields=["dramatis_persona", "restriction", "additional_note"], name="dramatis_persona_restriction_once"
            )
        ]
