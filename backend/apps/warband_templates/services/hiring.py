"""Hiring from the warband's template (the templates plan, phase 2): a recruit naming a `fighter_key` (Add hero, Add
group, camp's Recruit for a new group) is filled from that fighter of the warband's template, as its variant has him.

What the fighter gives goes under what the recruit sent, so the dialog's name, type, race, cost and starting XP win:
his type (the fighter's name), race, profile (written values as written), skill groups, spell lores, caster, Large,
leader, rules (his specials), the skills his variant gives him (the Hung's heroes' Ride [Animal]), starting XP, and
for a group its size, gains-XP (no level-ups) and promotable. The unit remembers the key; nothing links it to the
template after, so a later template edit touches nothing on the roster.

Every hire of a fighter gets one of each item his lists mark "1st free" at no cost, each item once (William, 6 Nov 2026:
the Dagger, and the Gnoblars' Sharp Stuff too), before and after the first battle (a group: every member, as its
loadout, so a member who joins later carries them at no cost). A fighter with no list gets none, nor one whose list
prices the item instead. A unit typed by hand (no key) gets nothing.
"""

from typing import TYPE_CHECKING, Any

from django.db.models import Prefetch

from apps.warbands.models import Warband
from apps.warbands.units.errors import FieldErrors
from apps.warbands.utils.stats import stat_inputs

from ..models import HENCHMAN, HERO, TemplateFighter, TemplateFighterSpecial, TemplateListItem
from .resolve import apply_variant, start_skills, templates_for_type, warband_variant

if TYPE_CHECKING:
    from apps.warbands.units.kinds import UnitKindSpec

FIGHTER_KINDS = {"hero": HERO, "henchmen_group": HENCHMAN}  # the unit kind -> the fighters it recruits
NOT_HIS = {HERO: "Not one of this warband's template heroes.", HENCHMAN: "Not one of this warband's template henchmen."}


def unit_body(kind_key: str, fighter: TemplateFighter) -> dict[str, Any]:
    """The create body the fighter makes for the kind (heroes or henchmen groups)."""
    body: dict[str, Any] = {
        "fighter_key": fighter.key,
        "unit_type": fighter.name[:80],
        "race": fighter.race_id,
        "price": fighter.cost,
        "xp": fighter.starting_xp,
        "large": fighter.large,
        **stat_inputs(fighter),
        "special_ids": [link.special_id for link in fighter.special_links.all()],
    }
    skills = [int(entry["id"]) for entry in start_skills(fighter) if entry.get("id")]
    if skills:
        body["skill_ids"] = skills
    if kind_key == "hero":
        return {
            **body,
            "is_leader": fighter.is_leader,
            "caster": fighter.caster,
            "available_skills": list(fighter.skill_types or []),
            "available_spell_types": [str(lore.get("name")) for lore in fighter.spell_types or [] if lore.get("name")],
        }
    group: dict[str, Any] = {"no_level_ups": not fighter.gains_xp, "promotable": fighter.promotable}
    if fighter.group_max:
        group["max_size"] = fighter.group_max
    return {**body, **group}


def free_items(fighters: list[TemplateFighter], variant: str) -> dict[str, list[int]]:
    """Fighter key -> the items a hire of his gets free: the item of each "1st free" line of his lists for the
    variant, in his lists' order, each item once (one query)."""
    lines = (
        TemplateListItem.objects.filter(
            first_free=True, equipment_list__fighter_links__fighter__in=fighters, variant__in=("", variant)
        )
        .order_by("equipment_list__position", "position", "id")
        .values_list("equipment_list__fighter_links__fighter__key", "item_id")
    )
    found: dict[str, list[int]] = {}
    for key, item_id in lines:
        items = found.setdefault(key, [])
        if item_id not in items:
            items.append(item_id)
    return found


def fill_from_template(
    kind: "UnitKindSpec", warband: Warband, entries: list[dict[str, Any]], errors: FieldErrors
) -> dict[int, list[int]]:
    """Fill, in place, each create entry naming a `fighter_key` from that fighter of the warband's template (three
    queries, only when one does); an unknown key, or a hero's key sent as a group, is an error on the entry. The items
    each filled create gets free, by its index."""
    keyed = [(index, entry) for index, entry in enumerate(entries) if entry.get("fighter_key")]
    wanted = FIGHTER_KINDS.get(kind.key)
    if not keyed or wanted is None:
        return {}
    specials = Prefetch("special_links", queryset=TemplateFighterSpecial.objects.order_by("position", "id"))
    rows = templates_for_type(warband.campaign_id, warband.warband_type_id)
    template = rows.prefetch_related(Prefetch("fighters", queryset=TemplateFighter.objects.prefetch_related(specials)))
    found = template.first()
    variant = warband_variant(warband, found) if found is not None else ""
    fighters = {row.key: apply_variant(row, variant) for row in found.fighters.all()} if found is not None else {}
    free = free_items(list(fighters.values()), variant) if fighters else {}
    given: dict[int, list[int]] = {}
    for index, entry in keyed:
        fighter = fighters.get(str(entry["fighter_key"]))
        if fighter is None or fighter.kind != wanted:
            errors[f"create.{index}.fighter_key"] = [NOT_HIS[wanted]]
            continue
        for field, value in unit_body(kind.key, fighter).items():
            entry.setdefault(field, value)
        if fighter.key in free:
            given[index] = free[fighter.key]
    return given
