"""What a warband may make its weapons of (weapon materials, William 19 Nov 2026).

The four materials are hard-coded data (`apps/items/materials.py`). This is the only place that reads them against a
warband: who may take each, worded as every other who-can line is (`who_can.py`), and what putting one on a weapon
the warband already owns costs. Obsidian's book rule names who may never use it (Dwarfs, Elves, Sisters of Sigmar,
Witch Hunters), so it carries those as excluded who-can lines, read exactly as a price row's are: the answer is a
warning, never a block, and the pages show it without re-deriving it.

Three queries for every material together: the excluded warband types, the excluded warband groups, and the
materials' settings with whether the campaign has each in play.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from django.db.models import Exists, OuterRef

from apps.campaigns.models import CampaignCampaignType, CampaignType
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

    def lines(self, material: Material) -> list[AccessLine]:
        """The material's who-can lines: whom its rule shuts out."""
        lines = [AccessLine(warband_type_id=self.types[slug]) for slug in material.excluded_types if slug in self.types]
        lines += [
            AccessLine(warband_group_id=self.groups[slug]) for slug in material.excluded_groups if slug in self.groups
        ]
        return lines


def _slugs(attribute: str) -> set[str]:
    return {slug for material in MATERIALS.values() for slug in getattr(material, attribute)}


def read_catalogue(campaign_id: int) -> Catalogue:
    """The warband types, groups and settings the materials name (three queries)."""
    types = dict(
        WarbandType.objects.filter(campaign__isnull=True, slug__in=_slugs("excluded_types")).values_list("slug", "id")
    )
    groups = dict(WarbandGroup.objects.filter(slug__in=_slugs("excluded_groups")).values_list("slug", "id"))
    wanted = {material.setting for material in MATERIALS.values()}
    chosen = CampaignCampaignType.objects.filter(campaign_id=campaign_id, campaign_type_id=OuterRef("id"))
    settings = CampaignType.objects.filter(slug__in=wanted).annotate(ticked=Exists(chosen))
    rows = list(settings.values_list("slug", "name", "always_on", "ticked"))
    in_play = {slug for slug, _name, always_on, ticked in rows if always_on or ticked}
    return Catalogue(types, groups, in_play, {slug: name for slug, name, _always, _ticked in rows})


def material_payload(material: Material, buyer: Buyer, catalogue: Catalogue) -> dict[str, Any]:
    """One material as the pages read it: its rules, its own rarity, how it prices, whether this warband may usually
    take it and why not. Every reason is the server's wording."""
    reasons = [] if step(True, catalogue.lines(material), buyer) else [not_usually(buyer)]
    if material.setting not in catalogue.in_play:
        reasons.append(out_of_play(catalogue.setting_names.get(material.setting, "Its setting")))
    return {
        "slug": material.slug,
        "name": material.name,
        "rarity": material.rarity,
        "price_note": material.price_note,
        "multiplier": material.multiplier,
        "addition": material.addition,
        "on_owned": material.on_owned,
        "rules": [{"name": rule.name, "text": rule.text} for rule in material.rules],
        "can_take": not reasons,
        "reason": " ".join(reasons),
    }


def material_offers(campaign_id: int, buyer: Buyer, materials: Iterable[Material] | None = None) -> list[dict]:
    """Every material as this warband sees it, in registry order."""
    catalogue = read_catalogue(campaign_id)
    rows = list(materials) if materials is not None else list(MATERIALS.values())
    return [material_payload(material, buyer, catalogue) for material in rows]
