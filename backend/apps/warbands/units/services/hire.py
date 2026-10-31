"""Hiring a hired sword or a dramatis persona from the catalogue (the bestiary rewrite step 2), or one typed by hand.

The server copies the campaign's current entry (its version of a book entry, CAT-TWEAK-03) onto the warband as a new
hireling that keeps no link back: everything but the description (fluff), with both fees, and the skills, specials
and spells as the campaign's current entries. The kit becomes one item row per copy (the Ogre's two swords are two
rows) with no cost, since the fee includes it. A dramatis persona also takes the Hero injury table, no level-ups, how
long it stays and what it is paid in. A hand-typed hire (`custom`) is the name, type and fees sent.

What is paid is the player's to set (the fees and skill lists step): the gold sent, else the fee's gold plus the dice
roll sent; each resource line from the counter sent, else the fee's lines from the counters of their names
(fee_payments.py). A fee in his rules is hired at 0 gc with a warning; one who takes a hero's place warns at the hero
cap and may let a hero go in the same request (`dismiss_hero_id`). The unit goes through the shared recruit path, so
the hired-sword cap, the HIRE ledger row (the gold, and the resources in its note) and the log are the generic
create's. A dramatis persona sits outside the cap; hiring one the warband already has warns (one of each), and so does
hiring an entry the campaign archived or removed. A kit's first mount is switched on as its mount (the bestiary
rewrite step 4), with the companion warnings. A fixed number of queries whatever the kit's size.
"""

from collections.abc import Mapping
from dataclasses import dataclass, field, replace
from typing import Any

from django.db import transaction
from django.db.models import Exists, F, OuterRef, Prefetch, QuerySet
from rest_framework.exceptions import NotFound

from apps.bestiary.models import MOUNT
from apps.core.catalogue.current import current_rows, resolve
from apps.core.models import CatalogueRemoval
from apps.hirelings.fees import gold_due, make_fee, no_fee
from apps.hirelings.models import MAX_KIT_QUANTITY, DramatisPersona, HiredSword, HirelingProfile
from apps.hirelings.selectors import link_model
from apps.items.models import Item
from apps.warbands.models import Hireling, HirelingItem, Warband, on_roster
from apps.warbands.units.kinds import HIRELING
from apps.warbands.utils.leaders import lock_warband

from .companions import unit_warnings
from .create import recruit
from .fee_payments import ResourceLine, fee_lines, locked_counters, pay, sent_lines
from .fee_rules import fee_warnings, make_room

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
    "hire_fee",
    "upkeep_fee",
)
PERSONA = {"injury_table": "hero", "no_level_ups": True}  # what a dramatis persona's kind brings


@dataclass
class Hired:
    unit: Hireling
    warnings: list[dict[str, Any]] = field(default_factory=list)


@dataclass(frozen=True)
class HireTerms:
    """What the hire pays and the room it makes: the gold, the resource lines and a hero to let go."""

    gold: int
    lines: list[ResourceLine]
    dismiss_hero_id: int | None = None
    warnings: tuple[dict[str, Any], ...] = ()


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


def hire_terms(body: Mapping[str, Any], fee: Mapping[str, Any], name: str) -> HireTerms:
    """The gold and resources the request pays (each as sent, else as the fee asks) and its warnings."""
    gold = body.get("price")
    warnings: list[dict[str, Any]] = []
    if gold is None:
        gold = gold_due(fee, body.get("dice_roll"))
        if fee.get("kind") == "gold" and fee.get("dice") and body.get("dice_roll") is None:
            message = f"{name}'s {fee['dice']}D6 wasn't rolled: {gold} gc charged."
            warnings.append({"code": "fee_not_rolled", "message": message})
    sent = body.get("resources")
    lines = sent_lines(sent) if sent is not None else fee_lines(fee)
    return HireTerms(gold, lines, body.get("dismiss_hero_id"), tuple(warnings))


def hire_payload(source: str, entry: Any, name: str | None, gold: int) -> dict[str, Any]:
    """The hireling create body the entry makes (the generic create serializer maps its ids to current entries)."""
    payload = {
        "name": (name or "").strip()[:120] or entry.name[:120],
        "unit_type": entry.name[:80],  # what it was hired as ("Ogre Bodyguard")
        "kind": source,
        "race": entry.race_id,
        "price": gold,  # what this hire cost in gold
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


def custom_payload(body: Mapping[str, Any], terms: HireTerms) -> dict[str, Any]:
    """A hand-typed hire's create body: its name and type, the gold paid, the fee it was hired for and its upkeep."""
    unit_type = (body.get("unit_type") or "").strip()[
        :80
    ] or "Hired sword"  # a type is needed: the name then reads well
    lines = [(line.resource, line.amount) for line in terms.lines]
    return {
        "name": (body.get("name") or "").strip()[:120] or unit_type or HIRELING.unknown_name,
        "unit_type": unit_type,
        "kind": "hired_sword",
        "race": None,
        "price": terms.gold,
        "hire_fee": make_fee(gold=terms.gold, resources=lines),
        "upkeep_fee": body.get("upkeep_fee") or no_fee(),
    }


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


def hire(warband: Warband, writer: Any, source: str, entry: Any, terms: HireTerms) -> Hired:
    """Recruit the validated hireling (`writer`, from `hire_payload` or `custom_payload`) with the entry's kit (none
    for a custom hire), paying `terms`, in one transaction."""
    fee = writer.validated_data.get("hire_fee") or no_fee()
    name = writer.validated_data.get("name") or ""
    with transaction.atomic():
        lock_warband(warband.id)  # the gold's row first, then the heroes and the counters
        warnings = [*terms.warnings, *(_warnings(source, entry, warband) if entry is not None else [])]
        make_room(warband, terms.dismiss_hero_id)
        warnings += fee_warnings(warband, fee, name)
        lines = [replace(line, who=name) for line in terms.lines]
        payment = pay(lines, locked_counters(warband.id) if lines else [])
        sent = {**writer.initial_data, "paid": payment.note}
        unit: Hireling = recruit(HIRELING, warband, writer, sent=sent, locked=True)  # type: ignore[assignment]
        warnings += payment.warnings
        if entry is not None and _kit(unit, entry, warband.campaign_id):
            warnings += unit_warnings(HIRELING, warband, unit)
    return Hired(unit, warnings)
