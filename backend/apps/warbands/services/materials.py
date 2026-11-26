"""What a warband may make its weapons of (weapon materials, William 19 Nov 2026).

The materials are hard-coded data (`apps/items/materials.py`). This is the only place that reads them against a
warband: who may take each, worded as every other who-can line is (`who_can.py`). Obsidian's book rule names who
may never use it (Dwarfs, Elves, Sisters of Sigmar, Witch Hunters), so it carries those as excluded who-can lines;
the two darksteels belong to the warbands whose template list sells them (`from_lists`), so their lines name the
warband types those templates serve, worked out here and never hard-coded, because a list may serve several types.
Both are read exactly as a price row's lines are: the answer is a warning, never a block, and the pages show it
without re-deriving it. Nothing here puts a material on a weapon the warband already owns: an item is never
transformed (William, 20 Nov 2026).

Four queries for every material together: the warband types their lines name, the warband groups, the warband types
whose template list sells each material, and the materials' settings with whether the campaign has each in play.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from django.db.models import BooleanField, ExpressionWrapper, Q

from apps.campaigns.in_play import ticked
from apps.campaigns.models import CampaignType
from apps.items.materials import MATERIALS, Material
from apps.warbands.models import WarbandGroup, WarbandType

from .who_can import Buyer, not_usually, out_of_play, step


@dataclass(frozen=True)
class AccessLine:
    """A who-can line as `who_can.step` reads one: a warband type or a warband group, excluded."""

    warband_type_id: int | None = None
    warband_group_id: int | None = None
    excluded: bool = True


@dataclass(frozen=True)
class Catalogue:
    """The ids and settings every material's lines name, read once."""

    types: dict[str, int]
    groups: dict[str, int]
    in_play: set[str]  # the setting slugs the campaign has in play
    setting_names: dict[str, str]
    sold_to: dict[str, list[int]]  # material slug -> the warband types whose template list sells it

    def lines(self, material: Material) -> list[AccessLine]:
        """The material's who-can lines: whom its rule names, and whom it shuts out."""
        named = self.sold_to.get(material.slug, []) if material.from_lists else []
        lines = [AccessLine(warband_type_id=type_id, excluded=False) for type_id in named]
        lines += [
            AccessLine(warband_type_id=self.types[slug]) for slug in material.excluded_types if slug in self.types
        ]
        lines += [
            AccessLine(warband_group_id=self.groups[slug]) for slug in material.excluded_groups if slug in self.groups
        ]
        return lines


def _slugs(attribute: str) -> set[str]:
    return {slug for material in MATERIALS.values() for slug in getattr(material, attribute)}


def sold_to(campaign_id: int) -> dict[str, list[int]]:
    """For each material a warband list sells (`from_lists`), the warband types those templates serve (one query):
    the Druchii's darksteel is the Druchii's, the Dark Elves' blade the Dark Elves'. The campaign's own templates
    count with the book's, as every other read of them does; an archived template serves nobody."""
    from apps.warband_templates.models import TemplateListItem  # it reads the warbands app

    wanted = [material.slug for material in MATERIALS.values() if material.from_lists]
    book = Q(equipment_list__template__campaign__isnull=True)
    rows = TemplateListItem.objects.filter(
        book | Q(equipment_list__template__campaign_id=campaign_id),
        material__in=wanted,
        equipment_list__template__archived_at__isnull=True,
    ).values_list("material", "equipment_list__template__type_links__warband_type_id")
    found: dict[str, list[int]] = {}
    for slug, type_id in rows:
        if type_id is not None and type_id not in found.setdefault(slug, []):
            found[slug].append(type_id)
    return found


def read_catalogue(campaign_id: int) -> Catalogue:
    """The warband types, groups, lists and settings the materials name (four queries)."""
    types = dict(
        WarbandType.objects.filter(campaign__isnull=True, slug__in=_slugs("excluded_types")).values_list("slug", "id")
    )
    groups = dict(WarbandGroup.objects.filter(slug__in=_slugs("excluded_groups")).values_list("slug", "id"))
    wanted = {material.setting for material in MATERIALS.values()}
    settings = CampaignType.objects.filter(slug__in=wanted).annotate(
        ticked=ExpressionWrapper(ticked(campaign_id, "id"), BooleanField())
    )
    rows = list(settings.values_list("slug", "name", "always_on", "ticked"))
    in_play = {slug for slug, _name, always_on, chosen in rows if always_on or chosen}
    names = {slug: name for slug, name, _always, _ticked in rows}
    return Catalogue(types, groups, in_play, names, sold_to(campaign_id))


def only_payload(material: Material, items: Sequence[Any]) -> dict[str, Any] | None:
    """The only weapons the material's own rule allows (by the item's name and tags), with the rule's own sentence;
    None where its rule names none, so every melee weapon may be made of it."""
    if not material.only_names:
        return None
    return {"text": material.only_text, "item_ids": [item.pk for item in items if material.allows(item)]}


def material_payload(
    material: Material, buyer: Buyer, catalogue: Catalogue, items: Sequence[Any] = ()
) -> dict[str, Any]:
    """One material as the pages read it: its rules, its own rarity, how it prices, what its store row is called,
    the word it puts in front of a weapon's name, whether this warband may usually take it and why not, whether its
    setting is in play (a unit's own list in the store leaves out one that isn't: William, 22 Nov 2026), and the only
    weapons its own rule allows. Every reason is the server's wording."""
    reasons = [] if step(material.for_everyone, catalogue.lines(material), buyer) else [not_usually(buyer)]
    in_play = material.setting in catalogue.in_play
    if not in_play:
        reasons.append(out_of_play(catalogue.setting_names.get(material.setting, "Its setting")))
    return {
        "slug": material.slug,
        "name": material.name,
        "row_name": material.shown_as,
        "prefix": material.word,
        "rarity": material.rarity,
        "for_everyone": material.for_everyone,
        "price_note": material.price_note,
        "multiplier": material.multiplier,
        "addition": material.addition,
        "rules": [{"name": rule.name, "text": rule.text} for rule in material.rules],
        "can_take": not reasons,
        "reason": " ".join(reasons),
        "in_play": in_play,
        "only": only_payload(material, items),
    }


def material_offers(campaign_id: int, buyer: Buyer, items: Sequence[Any] = ()) -> list[dict]:
    """Every material as this warband sees it, in registry order. `items`: the campaign's current items, already
    read for the item offers, for a material whose rule names which weapons may be made of it."""
    catalogue = read_catalogue(campaign_id)
    return [material_payload(material, buyer, catalogue, items) for material in MATERIALS.values()]
