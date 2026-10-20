import math
import re
from typing import Any

from django.db import models

from apps.warbands.models import HenchmenGroupItem, HeroItem, HiredSwordItem, WarbandItem

from .models import Item, ItemAvailability, ItemAvailabilityRestriction, ItemPropertyLink

HALF_PRICE_ARMOUR_EFFECT_KEY = "half_price_armour"
IMPROVED_SHIELDS_EFFECT_KEY = "improved_shields"


def _prefetched_base_items(subtype):
    """The base catalogue's armour of this subtype ("Armour" or "Shield") with what a clone copies (IMP-67)."""
    return (
        Item.objects.filter(
            campaign__isnull=True,
            type="Armour",
            subtype=subtype,
        )
        .prefetch_related(
            "property_links",
            models.Prefetch(
                "availabilities",
                queryset=ItemAvailability.objects.prefetch_related("restriction_links"),
            ),
        )
        .order_by("id")
    )


def _clone_item_fields(source, clone, campaign_id, effect_key, *, save_value=None):
    clone.campaign_id = campaign_id
    clone.source_item = source
    clone.generated_effect_key = effect_key
    clone.name = source.name
    clone.type = source.type
    clone.subtype = source.subtype
    clone.grade = source.grade
    clone.single_use = source.single_use
    clone.description = source.description
    clone.strength = source.strength
    clone.range = source.range
    clone.save_value = source.save_value if save_value is None else save_value
    clone.statblock = source.statblock
    clone.bestiary_entry = source.bestiary_entry


def _sync_property_links(source, clone):
    ItemPropertyLink.objects.filter(item=clone).delete()
    links = [
        ItemPropertyLink(item=clone, property_id=link.property_id)
        for link in source.property_links.all()
        if link.property_id
    ]
    if links:
        ItemPropertyLink.objects.bulk_create(links)


def _half_price(availability):
    return int(math.ceil((availability.cost or 0) / 2))


def _same_price(availability):
    return availability.cost


def _sync_availabilities(source, clone, cost_fn):
    """The clone's availabilities become the source's, each at `cost_fn(availability)`, with their restrictions
    (IMP-67: one path for every effect; the rows in one INSERT, their restrictions in another)."""
    ItemAvailability.objects.filter(item=clone).delete()
    source_availabilities = list(source.availabilities.all())
    cloned = ItemAvailability.objects.bulk_create(
        [
            ItemAvailability(
                item=clone,
                cost=cost_fn(availability),
                rarity=availability.rarity,
                variable_cost=availability.variable_cost,
            )
            for availability in source_availabilities
        ]
    )
    restriction_links = [
        ItemAvailabilityRestriction(
            item_availability=cloned_availability,
            restriction_id=link.restriction_id,
            additional_note=link.additional_note,
        )
        for availability, cloned_availability in zip(source_availabilities, cloned, strict=True)
        for link in availability.restriction_links.all()
        if link.restriction_id
    ]
    if restriction_links:
        ItemAvailabilityRestriction.objects.bulk_create(restriction_links)


OWNED_ITEM_ROWS = (  # the units' carried items, with the path to their campaign
    (HeroItem, "hero__warband__campaign_id"),
    (HenchmenGroupItem, "henchmen_group__warband__campaign_id"),
    (HiredSwordItem, "hired_sword__warband__campaign_id"),
)


def _remap_rows(model: Any, campaign_path: str, campaign_id, item_id_map) -> None:
    """One kind of carried item: every row of the campaign's on a mapped item moves, in one UPDATE (IMP-67,
    PERF-44's bulk half)."""
    rows = list(model.objects.filter(**{campaign_path: campaign_id}, item_id__in=item_id_map.keys()))
    for row in rows:
        row.item_id = item_id_map[row.item_id]
    if rows:
        model.objects.bulk_update(rows, ["item"])


def _remap_campaign_owned_rows(campaign_id, item_id_map):
    """Point the campaign's owned copies of each item at its replacement. Each row keeps its stored purchase cost:
    what the warband paid, which sales and values read (BUG-51)."""
    if not item_id_map:
        return

    for model, campaign_path in OWNED_ITEM_ROWS:
        _remap_rows(model, campaign_path, campaign_id, item_id_map)

    from apps.warbands.services.stash import add_to_stash  # the stash's row per item and cost (BUG-117)

    stash_rows = WarbandItem.objects.filter(warband__campaign_id=campaign_id, item_id__in=item_id_map.keys())
    for stash_item in list(stash_rows):
        target_item_id = item_id_map.get(stash_item.item_id)
        if target_item_id is None:
            continue
        # the copies move to the target item at the cost they were bought at, joining copies already at that cost
        stash_item.delete()
        add_to_stash(stash_item.warband_id, target_item_id, stash_item.quantity or 0, stash_item.cost)


def _retire_clones(campaign_id, clones):
    """Move the campaign's owned copies of these clones back to their source items, then delete the clones (deleting
    first would cascade and delete the owned copies, BUG-51)."""
    clones = [clone for clone in clones if clone.source_item_id]
    if not clones:
        return
    _remap_campaign_owned_rows(campaign_id, {clone.id: clone.source_item_id for clone in clones})
    Item.objects.filter(id__in=[clone.id for clone in clones]).delete()


def _revert_generated_items_for_campaign(campaign_id, effect_key):
    clones = Item.objects.filter(campaign_id=campaign_id, generated_effect_key=effect_key, source_item__isnull=False)
    _retire_clones(campaign_id, list(clones.only("id", "source_item_id")))


def _sync_generated_items_for_campaign(
    campaign_id,
    *,
    effect_key,
    source_items,
    clone_sync_fn,
):
    source_items = list(source_items)
    source_ids = [item.id for item in source_items]
    existing_clones = {
        clone.source_item_id: clone
        for clone in Item.objects.filter(
            campaign_id=campaign_id,
            generated_effect_key=effect_key,
            source_item_id__in=source_ids,
        ).select_related("source_item", "bestiary_entry")
    }

    clone_map = {}

    for source in source_items:
        clone = existing_clones.get(source.id)
        if clone is None:
            clone = Item()
        clone_sync_fn(source, clone)
        clone_map[source.id] = clone

    stale_clones = Item.objects.filter(campaign_id=campaign_id, generated_effect_key=effect_key).exclude(
        source_item_id__in=source_ids
    )
    _retire_clones(campaign_id, list(stale_clones.only("id", "source_item_id")))

    item_id_map = {source_id: clone.id for source_id, clone in clone_map.items()}
    _remap_campaign_owned_rows(campaign_id, item_id_map)


def sync_half_price_armour_for_campaign(campaign_id):
    def clone_sync_fn(source, clone):
        _clone_item_fields(source, clone, campaign_id, HALF_PRICE_ARMOUR_EFFECT_KEY)
        clone.save()
        _sync_property_links(source, clone)
        _sync_availabilities(source, clone, _half_price)

    _sync_generated_items_for_campaign(
        campaign_id,
        effect_key=HALF_PRICE_ARMOUR_EFFECT_KEY,
        source_items=_prefetched_base_items("Armour"),
        clone_sync_fn=clone_sync_fn,
    )


def revert_half_price_armour_for_campaign(campaign_id):
    _revert_generated_items_for_campaign(campaign_id, HALF_PRICE_ARMOUR_EFFECT_KEY)


def _format_improved_shield_save(save_value):
    cleaned = str(save_value or "").strip()
    match = re.fullmatch(r"(\d+)\+", cleaned)
    if not match:
        return cleaned
    current_value = int(match.group(1))
    improved_value = max(1, current_value - 1)
    return f"{cleaned} ({improved_value}+ CC)"


def sync_improved_shields_for_campaign(campaign_id):
    def clone_sync_fn(source, clone):
        _clone_item_fields(
            source,
            clone,
            campaign_id,
            IMPROVED_SHIELDS_EFFECT_KEY,
            save_value=_format_improved_shield_save(source.save_value),
        )
        clone.save()
        _sync_property_links(source, clone)
        _sync_availabilities(source, clone, _same_price)

    _sync_generated_items_for_campaign(
        campaign_id,
        effect_key=IMPROVED_SHIELDS_EFFECT_KEY,
        source_items=_prefetched_base_items("Shield"),
        clone_sync_fn=clone_sync_fn,
    )


def revert_improved_shields_for_campaign(campaign_id):
    _revert_generated_items_for_campaign(campaign_id, IMPROVED_SHIELDS_EFFECT_KEY)
