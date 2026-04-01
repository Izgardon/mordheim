import math
import re

from django.db import models

from apps.warbands.models import HeroItem, HenchmenGroupItem, HiredSwordItem, WarbandItem

from .models import Item, ItemAvailability, ItemAvailabilityRestriction, ItemPropertyLink

HALF_PRICE_ARMOUR_EFFECT_KEY = "half_price_armour"
IMPROVED_SHIELDS_EFFECT_KEY = "improved_shields"


def _prefetched_base_armour_items():
    return (
        Item.objects.filter(
            campaign__isnull=True,
            type="Armour",
            subtype="Armour",
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


def _prefetched_base_shield_items():
    return (
        Item.objects.filter(
            campaign__isnull=True,
            type="Armour",
            subtype="Shield",
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


def _single_availability_cost(item):
    availabilities = list(item.availabilities.all())
    if len(availabilities) != 1:
        return None
    return availabilities[0].cost


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


def _sync_discounted_availabilities(source, clone):
    ItemAvailability.objects.filter(item=clone).delete()
    source_availabilities = list(source.availabilities.all())
    for availability in source_availabilities:
        cloned_availability = ItemAvailability.objects.create(
            item=clone,
            cost=int(math.ceil((availability.cost or 0) / 2)),
            rarity=availability.rarity,
            variable_cost=availability.variable_cost,
        )
        restriction_links = [
            ItemAvailabilityRestriction(
                item_availability=cloned_availability,
                restriction_id=link.restriction_id,
                additional_note=link.additional_note,
            )
            for link in availability.restriction_links.all()
            if link.restriction_id
        ]
        if restriction_links:
            ItemAvailabilityRestriction.objects.bulk_create(restriction_links)


def _sync_matching_availabilities(source, clone):
    ItemAvailability.objects.filter(item=clone).delete()
    source_availabilities = list(source.availabilities.all())
    for availability in source_availabilities:
        cloned_availability = ItemAvailability.objects.create(
            item=clone,
            cost=availability.cost,
            rarity=availability.rarity,
            variable_cost=availability.variable_cost,
        )
        restriction_links = [
            ItemAvailabilityRestriction(
                item_availability=cloned_availability,
                restriction_id=link.restriction_id,
                additional_note=link.additional_note,
            )
            for link in availability.restriction_links.all()
            if link.restriction_id
        ]
        if restriction_links:
            ItemAvailabilityRestriction.objects.bulk_create(restriction_links)


def _remap_campaign_owned_rows(campaign_id, item_id_map, cost_by_target_id):
    if not item_id_map:
        return

    for row in HeroItem.objects.filter(hero__warband__campaign_id=campaign_id, item_id__in=item_id_map.keys()).iterator():
        target_item_id = item_id_map.get(row.item_id)
        if target_item_id is None:
            continue
        row.item_id = target_item_id
        row.cost = cost_by_target_id.get(target_item_id)
        row.save(update_fields=["item", "cost"])

    for row in HenchmenGroupItem.objects.filter(
        henchmen_group__warband__campaign_id=campaign_id,
        item_id__in=item_id_map.keys(),
    ).iterator():
        target_item_id = item_id_map.get(row.item_id)
        if target_item_id is None:
            continue
        row.item_id = target_item_id
        row.cost = cost_by_target_id.get(target_item_id)
        row.save(update_fields=["item", "cost"])

    for row in HiredSwordItem.objects.filter(
        hired_sword__warband__campaign_id=campaign_id,
        item_id__in=item_id_map.keys(),
    ).iterator():
        target_item_id = item_id_map.get(row.item_id)
        if target_item_id is None:
            continue
        row.item_id = target_item_id
        row.cost = cost_by_target_id.get(target_item_id)
        row.save(update_fields=["item", "cost"])

    stash_rows = WarbandItem.objects.filter(warband__campaign_id=campaign_id, item_id__in=item_id_map.keys()).select_related(
        "warband"
    )
    for row in stash_rows.iterator():
        target_item_id = item_id_map.get(row.item_id)
        if target_item_id is None:
            continue
        next_cost = cost_by_target_id.get(target_item_id)
        existing = (
            WarbandItem.objects.filter(warband=row.warband, item_id=target_item_id)
            .exclude(id=row.id)
            .first()
        )
        if existing:
            existing.quantity = (existing.quantity or 0) + (row.quantity or 0)
            existing.cost = next_cost
            existing.save(update_fields=["quantity", "cost"])
            row.delete()
            continue
        row.item_id = target_item_id
        row.cost = next_cost
        row.save(update_fields=["item", "cost"])


def _revert_generated_items_for_campaign(campaign_id, effect_key):
    generated_clones = list(
        Item.objects.filter(
            campaign_id=campaign_id,
            generated_effect_key=effect_key,
            source_item__isnull=False,
        )
        .select_related("source_item")
        .prefetch_related("source_item__availabilities")
    )
    if not generated_clones:
        return

    item_id_map = {}
    restored_cost_by_source_id = {}
    for clone in generated_clones:
        if not clone.source_item_id:
            continue
        item_id_map[clone.id] = clone.source_item_id
        source_cost = _single_availability_cost(clone.source_item)
        restored_cost_by_source_id[clone.source_item_id] = source_cost

    _remap_campaign_owned_rows(campaign_id, item_id_map, restored_cost_by_source_id)
    Item.objects.filter(id__in=[clone.id for clone in generated_clones]).delete()


def _sync_generated_items_for_campaign(
    campaign_id,
    *,
    effect_key,
    source_items,
    clone_sync_fn,
    cost_transform_fn,
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
    cost_by_clone_id = {}

    for source in source_items:
        clone = existing_clones.get(source.id)
        if clone is None:
            clone = Item()
        clone_sync_fn(source, clone)
        clone_map[source.id] = clone

        source_cost = _single_availability_cost(source)
        if source_cost is not None:
            cost_by_clone_id[clone.id] = cost_transform_fn(source_cost)

    stale_clones = Item.objects.filter(
        campaign_id=campaign_id,
        generated_effect_key=effect_key,
    ).exclude(source_item_id__in=source_ids)
    if stale_clones.exists():
        stale_clones.delete()

    item_id_map = {source_id: clone.id for source_id, clone in clone_map.items()}
    _remap_campaign_owned_rows(campaign_id, item_id_map, cost_by_clone_id)


def sync_half_price_armour_for_campaign(campaign_id):
    def clone_sync_fn(source, clone):
        _clone_item_fields(source, clone, campaign_id, HALF_PRICE_ARMOUR_EFFECT_KEY)
        clone.save()
        _sync_property_links(source, clone)
        _sync_discounted_availabilities(source, clone)

    _sync_generated_items_for_campaign(
        campaign_id,
        effect_key=HALF_PRICE_ARMOUR_EFFECT_KEY,
        source_items=_prefetched_base_armour_items(),
        clone_sync_fn=clone_sync_fn,
        cost_transform_fn=lambda source_cost: int(math.ceil(source_cost / 2)),
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
        _sync_matching_availabilities(source, clone)

    _sync_generated_items_for_campaign(
        campaign_id,
        effect_key=IMPROVED_SHIELDS_EFFECT_KEY,
        source_items=_prefetched_base_shield_items(),
        clone_sync_fn=clone_sync_fn,
        cost_transform_fn=lambda source_cost: source_cost,
    )


def revert_improved_shields_for_campaign(campaign_id):
    _revert_generated_items_for_campaign(campaign_id, IMPROVED_SHIELDS_EFFECT_KEY)
