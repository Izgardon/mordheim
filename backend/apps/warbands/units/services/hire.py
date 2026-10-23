"""Hiring a hired sword or a dramatis persona from the catalogue (the bestiary rewrite step 2).

The server copies the campaign's current entry (its version of a book entry, CAT-TWEAK-03) onto the warband as a new
hireling that keeps no link back: everything but the description (fluff), with the costs and both formulas, and the
skills, specials and spells as the campaign's current entries. The kit becomes one item row per copy (the Ogre's
two swords are two rows) with no cost, since the fee includes it. A dramatis persona also takes the Hero injury
table, no level-ups, how long it stays and what it is paid in. The unit goes through the shared recruit path, so
the hired-sword cap, the HIRE ledger row (when the fee is a number) and the log are the generic create's. A dramatis
persona sits outside the cap; hiring one the warband already has warns (one of each), and so does hiring an entry
the campaign archived or removed. A kit's first mount is switched on as its mount (the bestiary rewrite step 4), with the
companion warnings. A fixed number of queries whatever the kit's size.
"""

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from django.db import transaction
from django.db.models import Exists, F, OuterRef, Prefetch, QuerySet
from rest_framework.exceptions import NotFound

from apps.bestiary.models import MOUNT
from apps.core.catalogue.current import current_rows, resolve
from apps.core.models import CatalogueRemoval
from apps.hirelings.models import MAX_KIT_QUANTITY, DramatisPersona, HiredSword, HirelingProfile
from apps.hirelings.selectors import link_model
from apps.items.models import Item
from apps.warbands.models import Hireling, HirelingItem, Warband, on_roster
from apps.warbands.units.kinds import HIRELING

from .companions import unit_warnings
from .create import recruit

SOURCES: Mapping[str, tuple[type[HirelingProfile], str]] = {  # source -> the catalogue table and its kind key
    "hired_sword": (HiredSword, "hired_swords"),
    "dramatis_persona": (DramatisPersona, "dramatis_personae"),
}
COPIED = (
    "movement",
    "weapon_skill",
    "ballistic_skill",
    "strength",
    "toughness",
    "wounds",
    "initiative",
    "attacks",
    "leadership",
    "armour_save",
    "large",
    "caster",
    "hire_cost_expression",
    "upkeep_cost_expression",
)
PERSONA = {"injury_table": "hero", "no_level_ups": True}  # what a dramatis persona's kind brings


@dataclass
class Hired:
    unit: Hireling
    warnings: list[dict[str, Any]] = field(default_factory=list)


def catalogue_entry(source: str, entry_id: int, campaign_id: int) -> Any:
    """The campaign's current entry for the id (`removed` for the campaign or not) with its links: five queries; a
    version reverted since stands for its book entry's current entry (one more query, only then). Another campaign's
    entry, or an unknown id, is not found."""
    model, kind = SOURCES[source]
    removed = CatalogueRemoval.objects.filter(campaign_id=campaign_id, kind=kind, entry_id=OuterRef("pk"))
    links = [Prefetch(name, queryset=_ordered(model, name)) for name in ("skill_links", "special_links", "spell_links", "item_links")]  # fmt: skip
    rows = model._default_manager.annotate(removed=Exists(removed)).prefetch_related(*links)
    entry = resolve(rows, kind, [entry_id], campaign_id).get(entry_id)
    if entry is None:
        raise NotFound("Not found")
    return entry


def _ordered(model: type[HirelingProfile], relation: str) -> QuerySet[Any]:
    rows: QuerySet[Any] = link_model(model, relation).objects.order_by("id")
    return rows


def hire_payload(source: str, entry: Any, name: str | None) -> dict[str, Any]:
    """The hireling create body the entry makes (the generic create serializer maps its ids to current entries)."""
    payload = {
        "name": (name or "").strip()[:120] or entry.name[:120],
        "unit_type": entry.name[:80],  # what it was hired as ("Ogre Bodyguard")
        "kind": source,
        "race": entry.race_id,
        "price": entry.hire_cost or 0,  # a fee that isn't a number ("2 Treasure") is its formula alone
        "upkeep_price": entry.upkeep_cost or 0,  # likewise "1 piece of wyrdstone": postbattle reminds of it
        "rating": entry.rating or 0,
        "available_skills": list(entry.available_skill_types or []),
        **{column: getattr(entry, column) for column in COPIED},
        "skill_ids": [link.skill_id for link in entry.skill_links.all()],
        "special_ids": [link.special_id for link in entry.special_links.all()],
        "spell_ids": [link.spell_id for link in entry.spell_links.all()],
    }
    if source == "dramatis_persona":
        payload.update(PERSONA, stays=entry.stays, payment_note=entry.payment_note)
    return payload


def _warnings(source: str, entry: Any, warband: Warband) -> list[dict[str, Any]]:
    warnings = []
    if entry.archived_at or entry.removed:
        message = f"{entry.name} is archived in this campaign's catalogue; it was hired anyway."
        warnings.append({"code": "archived_entry", "message": message, "source": source, "id": entry.id})
    if source == "dramatis_persona":
        hired = on_roster(Hireling.objects.filter(warband=warband, kind=source, unit_type=entry.name[:80]))
        if hired.exists():
            message = f"{entry.name} is already in this warband: a dramatis persona is one of each."
            warnings.append({"code": "dramatis_persona_already_hired", "message": message, "id": entry.id})
    return warnings


def _kit(unit: Hireling, entry: Any, campaign_id: int) -> bool:
    """One item row per copy of each kit line (at most MAX_KIT_QUANTITY), as the campaign's current item, with no
    cost, the first mount switched on as its mount (the Freelancer's warhorse): two queries. Whether it rides."""
    lines = list(entry.item_links.all())
    items = Item.objects.only("id", "campaign_id", "replaces_id").annotate(beast_kind=F("bestiary_entry__kind"))
    current = current_rows(items, [line.item_id for line in lines], campaign_id)
    rows = [
        HirelingItem(hireling=unit, item_id=current[line.item_id].pk, cost=None)
        for line in lines
        if line.item_id in current
        for _copy in range(min(line.quantity, MAX_KIT_QUANTITY))  # a row written before the bound can't flood it
    ]
    kinds = {item.pk: item.beast_kind for item in current.values()}
    mount = next((row for row in rows if kinds.get(row.item_id) == MOUNT), None)
    if mount is not None:
        mount.companion = True
    HirelingItem.objects.bulk_create(rows)
    return mount is not None


def hire(warband: Warband, writer: Any, source: str, entry: Any) -> Hired:
    """Recruit the validated hireling (`writer`, from `hire_payload`) with the entry's kit, in one transaction."""
    with transaction.atomic():
        warnings = _warnings(source, entry, warband)
        unit: Hireling = recruit(HIRELING, warband, writer, sent=writer.initial_data)  # type: ignore[assignment]
        if _kit(unit, entry, warband.campaign_id):
            warnings += unit_warnings(HIRELING, warband, unit)
    return Hired(unit, warnings)
