"""A copy's custom content carried into the campaign it lands in (the workshop plan, version 2: "Imports carry custom
content"): a warband or a list copied into a campaign or another player's workshop brings every entry of its own it
uses (content_reads.py), each linked to the target's entry of the same name and effect where it holds one, else
copied as the target's own (`versions.copy_entries`, with its prices, rules, skills and the rest), a taken name
numbered, "Lucky Charm (2)".

For an importer who may edit the target's catalogue the copies are live, offered to everyone there; for anyone else
they arrive archived (as `archive.py` archives a deleted entry something holds), so the copy keeps them and nobody
else's pickers offer them. A copy's links to the source's other entries point at what those became; a line naming a
warband type that is another campaign's own is dropped. An item's shared rules of the source's own become the target's
(the same name and text, else a copy: shared rules are added, never archived). A skill group copied under a new name
is noted (`renamed`), so the copied units and fighters naming it name the copy. A fixed number of queries whatever
the number of entries: each kind is read, matched, copied and relinked in a few queries.
"""

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from django.db.models import Model, Q
from django.db.models.functions import Lower, Trim
from django.utils import timezone

from apps.campaigns.models import Campaign
from apps.core.catalogue.cache import bump
from apps.core.catalogue.kinds import BESTIARY, ITEMS, SKILL_GROUPS
from apps.core.catalogue.specs import CatalogueKindSpec
from apps.core.catalogue.versions import copy_entries
from apps.items.models import Item, ItemRule, ItemRuleLink
from apps.warbands.models import WarbandType

from .content_reads import CARRIED, Rows, Wanted, _relation, candidates, fingerprints, folded, wanted
from .relink import Warning, entry_links

ADDED = "Brought in as this campaign's own: {names}."
ARCHIVED = "Brought in archived, for this warband alone (nobody else here is offered them): {names}."
NUMBERED_ROOM = 6  # " (99)"


@dataclass
class Carried:
    """What the copy's custom content became: each source entry -> the target's, by model (for the relinker), the
    names of the copies made, and each skill group copied under a new name (its old name -> the copy's)."""

    own: dict[type[Model], dict[int, int]] = field(default_factory=dict)
    fresh: dict[type[Model], set[int]] = field(default_factory=dict)  # the sources copied (not linked), by model
    copied: list[str] = field(default_factory=list)
    renamed: dict[str, str] = field(default_factory=dict)
    kinds: set[str] = field(default_factory=set)

    def warnings(self, live: bool) -> list[Warning]:
        if not self.copied:
            return []
        names = sorted(set(self.copied))
        message = (ADDED if live else ARCHIVED).format(names=", ".join(names))
        return [
            {"code": "custom_content_added" if live else "custom_content_archived", "message": message, "names": names}
        ]


@dataclass(frozen=True)
class Target:
    campaign: Campaign
    user: Any
    live: bool  # the importer may edit its catalogue: the copies are offered to everyone there


def carry(
    source_campaign_id: int, target: Target, rows: Rows, known: Mapping[type[Model], Mapping[int, int]]
) -> Carried:
    """Link or copy every custom entry the rows use (`known`: already carried, kept), in the caller's transaction;
    the target's lists the copies change are bumped."""
    carried = Carried(own={model: dict(ids) for model, ids in known.items()})
    if source_campaign_id == target.campaign.pk:
        return carried
    found = wanted(source_campaign_id, rows, known)
    for kind in CARRIED:
        sources = found.of(kind)
        if kind is ITEMS:
            sources = [item for item in sources if getattr(item, "bestiary_entry_id", None) is None]
        if sources:
            _carry_kind(kind, sources, target, carried)
            if kind is BESTIARY:
                _carry_twins(found, target, carried)
    if carried.kinds:
        bump(target.campaign.pk, *sorted(carried.kinds))
    return carried


def _carry_kind(kind: CatalogueKindSpec, sources: list[Model], target: Target, carried: Carried) -> None:
    """Link each source to its match in the target, else copy it (a few queries, whatever their number)."""
    matches = candidates(kind, target.campaign.pk, [getattr(row, "name", "") for row in sources])
    prints = fingerprints(kind, [*sources, *matches])
    mapped = carried.own.setdefault(kind.model, {})
    copying = []
    for source in sources:
        match = next(
            (
                row
                for row in matches
                if folded(getattr(row, "name", "")) == folded(getattr(source, "name", ""))
                and prints[row.pk] == prints[source.pk]
            ),
            None,
        )
        if match is not None:
            mapped[source.pk] = match.pk
        else:
            copying.append(source)
    if copying:
        made = _copy(kind, copying, target, _free_names(kind, target.campaign.pk, copying))
        pairs: list[tuple[Any, Any]] = list(zip(copying, made, strict=True))
        mapped.update({source.pk: copy.pk for source, copy in pairs})
        carried.fresh.setdefault(kind.model, set()).update(source.pk for source, _ in pairs)
        carried.copied += [str(copy.name) for _, copy in pairs]
        carried.kinds.update(kind.changed_lists)
        _relink_children(kind, made, target, carried)
        if kind is SKILL_GROUPS:
            carried.renamed.update({str(old.name): str(new.name) for old, new in pairs if old.name != new.name})
        if kind is ITEMS:
            _carry_rules(made, target)


def _copy(
    kind: CatalogueKindSpec,
    sources: list[Model],
    target: Target,
    names: Mapping[int, str],
    extra: Mapping[int, Mapping[str, Any]] | None = None,
) -> list[Model]:
    """The sources as the target's own entries (one INSERT a table), archived for an importer who can't edit;
    `extra`: more changes to a source's copy."""
    now = timezone.now()
    stamp: dict[str, Any] = {"updated_by_id": target.user.pk, "updated_at": now}  # version off: replaces nothing
    if not target.live:
        stamp.update(archived_at=now, archived_by_id=target.user.pk)
    if any(found.name == "generated_effect_key" for found in kind.model._meta.concrete_fields):
        stamp["generated_effect_key"] = None  # a house rule's clone is the target's own entry now
    more = extra or {}
    changes = {source.pk: {**stamp, "name": names[source.pk], **more.get(source.pk, {})} for source in sources}
    return copy_entries(kind, sources, target.campaign.pk, version=False, changes=changes)


def _free_names(kind: CatalogueKindSpec, target_id: int, sources: list[Model]) -> dict[int, str]:
    """Each copy's name: its own, or numbered where the target or the book uses it (one query)."""
    bases = {source.pk: str(getattr(source, "name", "")).strip() for source in sources}
    starts = Q()
    for base in set(bases.values()):
        starts |= Q(name__istartswith=base[: 120 - NUMBERED_ROOM])
    taken = {
        folded(name)
        for name in kind.model._default_manager.filter(Q(campaign__isnull=True) | Q(campaign_id=target_id))
        .filter(starts)
        .values_list("name", flat=True)
    }
    names: dict[int, str] = {}
    for pk, base in bases.items():
        name, number = base, 2
        while folded(name) in taken:
            name, number = f"{base[: 120 - NUMBERED_ROOM]} ({number})", number + 1
        taken.add(folded(name))
        names[pk] = name
    return names


def _relink_children(kind: CatalogueKindSpec, made: list[Model], target: Target, carried: Carried) -> None:
    """The copies' child rows linking the source's entries link what those became, and a line naming another
    campaign's own warband type goes (one read and one write a child table that links any)."""
    copied: dict[str, dict[Any, Any]] = getattr(made[0], "copied_ids", {})
    for path in kind.children:
        ids = list(copied.get(path, {}).values())
        relation = _relation(kind, path)
        model: Any = relation.related_model
        links = [
            (attname, target_model)
            for attname, target_model, _ in entry_links(model)
            if attname != relation.field.attname
        ]
        if ids and any(found.name == "warband_type" for found in model._meta.concrete_fields):
            foreign = Q(warband_type__campaign__isnull=False) & ~Q(warband_type__campaign_id=target.campaign.pk)
            model._default_manager.filter(foreign, pk__in=ids).delete()
        if not ids or not links:
            continue
        rows = list(model._default_manager.filter(pk__in=ids))
        changed = [row for row in rows if _point(row, links, carried)]
        if changed:
            model._default_manager.bulk_update(changed, [attname for attname, _ in links])


def _point(row: Model, links: list[tuple[str, type[Model]]], carried: Carried) -> bool:
    moved = False
    for attname, model in links:
        value = getattr(row, attname)
        if value is not None and value in carried.own.get(model, {}):
            setattr(row, attname, carried.own[model][value])
            moved = True
    return moved


def _carry_twins(found: Wanted, target: Target, carried: Carried) -> None:
    """A beast's own item goes with it: a copied beast's is copied pointing at the copy, a linked beast's is the
    target beast's (one or two queries)."""
    beasts = carried.own.get(BESTIARY.model, {})
    copied = carried.fresh.get(BESTIARY.model, set())
    twins: list[Any] = [item for item in found.of(ITEMS) if item.bestiary_entry_id in beasts]
    linked = [item for item in twins if item.bestiary_entry_id not in copied]
    copying = [item for item in twins if item.bestiary_entry_id in copied]
    mapped = carried.own.setdefault(Item, {})
    if linked:
        theirs = Item.objects.filter(bestiary_entry_id__in={beasts[item.bestiary_entry_id] for item in linked})
        by_beast = dict(theirs.values_list("bestiary_entry_id", "pk"))
        mapped.update({item.pk: by_beast[beasts[item.bestiary_entry_id]] for item in linked})
    if copying:
        names = {item.pk: str(item.name) for item in copying}
        extra = {item.pk: {"bestiary_entry_id": beasts[item.bestiary_entry_id]} for item in copying}
        made = _copy(ITEMS, copying, target, names, extra)
        mapped.update({item.pk: copy.pk for item, copy in zip(copying, made, strict=True)})
        _carry_rules(made, target)


def _carry_rules(items: list[Model], target: Target) -> None:
    """The copied items' shared rules that are another campaign's own become the target's: one of the same name and
    text (the book's or the target's), else a copy (a few queries)."""
    links = list(
        ItemRuleLink.objects.filter(item_id__in=[item.pk for item in items], rule__campaign__isnull=False)
        .exclude(rule__campaign_id=target.campaign.pk)
        .select_related("rule")
    )
    if not links:
        return
    rules = {link.rule_id: link.rule for link in links if link.rule is not None}
    theirs: Any = ItemRule.objects.filter(Q(campaign__isnull=True) | Q(campaign_id=target.campaign.pk))
    theirs = theirs.annotate(folded=Lower(Trim("name"))).filter(folded__in={folded(r.name) for r in rules.values()})
    held = {(row.folded, row.text.strip()): row.pk for row in theirs}
    missing = [rule for rule in rules.values() if (folded(rule.name), rule.text.strip()) not in held]
    made = ItemRule.objects.bulk_create(
        [
            ItemRule(
                campaign_id=target.campaign.pk,
                name=rule.name,
                summary=rule.summary,
                text=rule.text,
                prebattle_roll=rule.prebattle_roll,
                prebattle_text=rule.prebattle_text,
            )
            for rule in missing
        ]
    )
    held.update({(folded(rule.name), rule.text.strip()): copy.pk for rule, copy in zip(missing, made, strict=True)})
    for link in links:
        rule = rules[link.rule_id or 0]
        link.rule_id = held[(folded(rule.name), rule.text.strip())]
    ItemRuleLink.objects.bulk_update(links, ["rule_id"])
    if made:
        bump(target.campaign.pk, "item_rules")


def foreign_types(target_id: int, type_ids: set[int]) -> set[int]:
    """Of these warband types, those that are another campaign's own (one query; none for none)."""
    if not type_ids:
        return set()
    rows = WarbandType.objects.filter(pk__in=type_ids, campaign__isnull=False).exclude(campaign_id=target_id)
    return set(rows.values_list("pk", flat=True))
