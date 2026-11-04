"""Warband templates (the templates plan, phase 1b): a warband list as data, seeded from the catalogue import.

A template holds one warband list: the gold it starts with, its most warriors, its variants (Reikland, Middenheim,
Marienburg), its warband rules and its fighters, each with his cost, counts, profile, skill groups, spell lores,
rules and the equipment lists he buys from. It is a catalogue entry (`CatalogueEntry`), so a campaign's house
version replaces a book template through `replaces`, with its own copies of every child row (apps/core/catalogue).
The warband types it serves are `WarbandTemplateType` rows: one template per type in the book, and one per type in
each campaign. Raising and hiring from a template come later; nothing on a roster points at one yet.
"""

from django.db import models

from apps.core.models import CatalogueEntry, version_constraints
from apps.warbands.models.shared import WrittenStatBlock, stat_constraints
from apps.warbands.models.warband import MAX_RULE_TEXT

DEFAULT_STARTING_GOLD = 500  # a template whose book gives no figure reads as 500 gc
DEFAULT_MAX_MODELS = 15  # and as 15 warriors
HERO, HENCHMAN = "hero", "henchman"
FIGHTER_KINDS = ((HERO, "Hero"), (HENCHMAN, "Henchman"))
CASTERS = (("No", "No"), ("Wizard", "Wizard"), ("Priest", "Priest"))  # as on heroes


class WarbandTemplate(CatalogueEntry):
    """A warband list. `starting_gold` and `max_models` are the book's figures (null: 500 gc, 15 warriors); a warband
    raised from it will get the campaign's gold plus the difference from 500. `variants` are its subfactions in
    order, `[{"key": "reikland", "name": "Reikland"}]`: a type presets one, or the player picks."""

    campaign = models.ForeignKey(
        "campaigns.Campaign", related_name="warband_templates", null=True, blank=True, on_delete=models.CASCADE
    )  # null: the book
    campaign_type = models.ForeignKey(  # its setting, which holds its grade (grading phase 1)
        "campaigns.CampaignType", related_name="warband_templates", null=True, blank=True, on_delete=models.RESTRICT
    )
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=160, blank=True, default="")  # the import's: the book is upserted by it
    starting_gold = models.PositiveIntegerField(null=True, blank=True)
    max_models = models.PositiveSmallIntegerField(null=True, blank=True)
    variants = models.JSONField(default=list, blank=True)
    flavour = models.TextField(max_length=4000, blank=True, default="")
    source = models.CharField(max_length=200, blank=True, default="")  # "Mordheim Rulebook"
    link_url = models.URLField(max_length=500, blank=True, default="")  # mordheimer's page
    notes = models.TextField(max_length=4000, blank=True, default="")  # editor's notes

    class Meta:
        db_table = "warband_template"
        ordering = ["name", "id"]
        constraints = [
            *version_constraints("warband_template"),
            models.UniqueConstraint(
                fields=["campaign", "name"], name="warband_template_unique_name", nulls_distinct=False
            ),
            models.UniqueConstraint(
                fields=["slug"],
                condition=models.Q(campaign__isnull=True) & ~models.Q(slug=""),
                name="warband_template_slug",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class WarbandTemplateType(models.Model):
    """A warband type the template serves, and the variant that type always is (Reiklanders: reikland; blank: the
    player picks one when raising). `campaign` is the template's, so a type has one template in the book and one in
    each campaign (the campaign's own, or its house version of the book's)."""

    template = models.ForeignKey(WarbandTemplate, related_name="type_links", on_delete=models.CASCADE)
    campaign = models.ForeignKey(
        "campaigns.Campaign", related_name="+", null=True, blank=True, on_delete=models.CASCADE
    )
    warband_type = models.ForeignKey("warbands.WarbandType", related_name="template_links", on_delete=models.CASCADE)
    variant = models.CharField(max_length=40, blank=True, default="")

    class Meta:
        db_table = "warband_template_type"
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(
                fields=["campaign", "warband_type"], name="warband_template_type_once", nulls_distinct=False
            ),
        ]

    def __str__(self) -> str:
        return f"{self.template_id}:{self.warband_type_id}"


class TemplateRule(models.Model):
    """One of the template's warband rules, in the book's order: the same shape as a warband's own rules
    (`WarbandRule`), which raising will copy them into. `variant`: blank for every variant, else its key."""

    template = models.ForeignKey(WarbandTemplate, related_name="rules", on_delete=models.CASCADE)
    position = models.PositiveSmallIntegerField(default=0)
    title = models.CharField(max_length=160)
    description = models.TextField(max_length=MAX_RULE_TEXT, blank=True, default="")
    variant = models.CharField(max_length=40, blank=True, default="")

    class Meta:
        db_table = "template_rule"
        ordering = ["position", "id"]

    def __str__(self) -> str:
        return f"{self.template_id}:{self.title}"


class TemplateFighter(WrittenStatBlock):
    """A hero or a henchman the template recruits: `key` is stable inside the template ("champion"), what a unit
    will remember it was recruited as. Counts: `min_count` to `max_count` (null: any number); a henchmen group holds
    `group_min` to `group_max`. `cost` is per model and `starting_xp` a hero's or a group's. `skill_types` are skill
    group names ("Combat", "Skaven"); `spell_types` the lores he casts from, `[{"name", "note"}]` ("with the Mark of
    Tchar the Eagle"). `variant_changes` holds, by variant key, what differs (`{"middenheim": {"skill_types": [...]}}`);
    `fixed_kit` what an animal carries ("None")."""

    template = models.ForeignKey(WarbandTemplate, related_name="fighters", on_delete=models.CASCADE)
    key = models.SlugField(max_length=80)
    position = models.PositiveSmallIntegerField(default=0)
    kind = models.CharField(max_length=10, choices=FIGHTER_KINDS)
    name = models.CharField(max_length=160)
    plural = models.CharField(max_length=160, blank=True, default="")
    race = models.ForeignKey(
        "races.Race", related_name="template_fighters", null=True, blank=True, on_delete=models.RESTRICT
    )
    cost = models.PositiveIntegerField(default=0)
    starting_xp = models.PositiveSmallIntegerField(default=0)
    min_count = models.PositiveSmallIntegerField(default=0)
    max_count = models.PositiveSmallIntegerField(null=True, blank=True)
    group_min = models.PositiveSmallIntegerField(null=True, blank=True)
    group_max = models.PositiveSmallIntegerField(null=True, blank=True)
    skill_types = models.JSONField(default=list, blank=True)
    spell_types = models.JSONField(default=list, blank=True)
    gains_xp = models.BooleanField(default=True)
    promotable = models.BooleanField(default=True)
    is_leader = models.BooleanField(default=False)
    caster = models.CharField(max_length=20, choices=CASTERS, default="No")
    large = models.BooleanField(default=False)
    variant_changes = models.JSONField(default=dict, blank=True)
    fixed_kit = models.TextField(max_length=1000, blank=True, default="")  # "None. Plague Bearers have huge claws …"
    flavour = models.TextField(max_length=4000, blank=True, default="")
    note = models.TextField(max_length=2000, blank=True, default="")

    class Meta:
        db_table = "template_fighter"
        ordering = ["position", "id"]
        constraints = [
            *stat_constraints("template_fighter"),
            models.UniqueConstraint(fields=["template", "key"], name="template_fighter_unique_key"),
        ]

    def __str__(self) -> str:
        return f"{self.template_id}:{self.key}"


class TemplateFighterSpecial(models.Model):
    """One of a fighter's rules, as a special: the template's own ("Warband - Mercenaries", owner kind warband) or
    the book's (Large, Wizard, Priest)."""

    fighter = models.ForeignKey(TemplateFighter, related_name="special_links", on_delete=models.CASCADE)
    special = models.ForeignKey("special.Special", related_name="template_fighter_links", on_delete=models.RESTRICT)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "template_fighter_special"
        ordering = ["position", "id"]
        constraints = [models.UniqueConstraint(fields=["fighter", "special"], name="template_fighter_special_once")]

    def __str__(self) -> str:
        return f"{self.fighter_id}:{self.special_id}"


class TemplateList(models.Model):
    """An equipment list ("Marksman equipment list") and its note ("This list is for Marksmen only.")."""

    template = models.ForeignKey(WarbandTemplate, related_name="lists", on_delete=models.CASCADE)
    key = models.SlugField(max_length=80)
    position = models.PositiveSmallIntegerField(default=0)
    name = models.CharField(max_length=160)
    note = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "template_list"
        ordering = ["position", "id"]
        constraints = [models.UniqueConstraint(fields=["template", "key"], name="template_list_unique_key")]

    def __str__(self) -> str:
        return f"{self.template_id}:{self.key}"


class TemplateListItem(models.Model):
    """A line of an equipment list: an item at its list price. `cost` null: see `cost_note` ("3 × price"). `shown_as`:
    the list's own name for the item ("Jambiya" for a Dagger). `first_free`: the "1st free" dagger. `who` narrows who
    may take it, by fighter key: `{}` everyone, `{"heroes": true}`, `{"fighters": [...]}` (with or without heroes),
    `{"except": [...]}`; others still may, with a warning. `warband_max`: at most this many in the warband (a
    warning)."""

    equipment_list = models.ForeignKey(TemplateList, related_name="lines", on_delete=models.CASCADE)
    position = models.PositiveSmallIntegerField(default=0)
    item = models.ForeignKey("items.Item", related_name="template_lines", on_delete=models.RESTRICT)
    shown_as = models.CharField(max_length=160, blank=True, default="")
    cost = models.PositiveIntegerField(null=True, blank=True)
    cost_note = models.CharField(max_length=120, blank=True, default="")
    first_free = models.BooleanField(default=False)
    brace_cost = models.PositiveIntegerField(null=True, blank=True)
    who = models.JSONField(default=dict, blank=True)
    warband_max = models.PositiveSmallIntegerField(null=True, blank=True)
    note = models.CharField(max_length=300, blank=True, default="")

    class Meta:
        db_table = "template_list_item"
        ordering = ["position", "id"]

    def __str__(self) -> str:
        return f"{self.equipment_list_id}:{self.item_id}"


class TemplateFighterList(models.Model):
    """A list a fighter buys from (the Marksmen: the Marksman list)."""

    fighter = models.ForeignKey(TemplateFighter, related_name="list_links", on_delete=models.CASCADE)
    equipment_list = models.ForeignKey(TemplateList, related_name="fighter_links", on_delete=models.CASCADE)

    class Meta:
        db_table = "template_fighter_list"
        ordering = ["id"]
        constraints = [models.UniqueConstraint(fields=["fighter", "equipment_list"], name="template_fighter_list_once")]

    def __str__(self) -> str:
        return f"{self.fighter_id}:{self.equipment_list_id}"


class TemplateUpgrade(models.Model):
    """A paid extra bought onto a fighter (a mutation, a Mark of Chaos): its group ("Mutations"), the special it
    gives, its cost (null: none in the book) and a note on who takes it."""

    template = models.ForeignKey(WarbandTemplate, related_name="upgrades", on_delete=models.CASCADE)
    position = models.PositiveSmallIntegerField(default=0)
    group = models.CharField(max_length=120)
    special = models.ForeignKey("special.Special", related_name="template_upgrades", on_delete=models.RESTRICT)
    cost = models.PositiveIntegerField(null=True, blank=True)
    cost_note = models.CharField(max_length=120, blank=True, default="")
    note = models.CharField(max_length=300, blank=True, default="")

    class Meta:
        db_table = "template_upgrade"
        ordering = ["position", "id"]

    def __str__(self) -> str:
        return f"{self.template_id}:{self.special_id}"
