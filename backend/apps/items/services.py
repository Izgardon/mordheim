import math
import re

from django.db import models

from apps.core.catalogue.cache import bump

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
    clone.replaces = source
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


def _retire_clones(campaign_id, clones):
    """The campaign's copies, bestiary equipment and animals of these clones go back to their book items, then the
    clones go: a Revert's path (core/catalogue/versions.py; copies hold items with RESTRICT, BUG-16, BUG-51)."""
    from apps.core.catalogue import kinds, versions

    versions.retire(kinds.ITEMS, campaign_id, clones)


def _revert_generated_items_for_campaign(campaign_id, effect_key):
    clones = Item.objects.filter(campaign_id=campaign_id, generated_effect_key=effect_key, replaces__isnull=False)
    _retire_clones(campaign_id, list(clones.only("id", "replaces_id")))
    bump(campaign_id, "items")  # its cached items list shows the clones (PERF-13), and members refetch it (BUG-80)


def _sync_generated_items_for_campaign(campaign_id, *, effect_key, source_items, clone_sync_fn):
    """Clone each book item into the campaign through `clone_sync_fn` (a clone it has already is synced again), retire
    the effect's clones of items no longer in `source_items`, and move the campaign's copies onto the clones. A book
    item the campaign already has its own version of is left alone; the skipped versions are returned."""
    from apps.core.catalogue import kinds, remap

    source_items = list(source_items)
    versions = {
        version.replaces_id: version
        for version in Item.objects.filter(
            campaign_id=campaign_id, replaces_id__in=[item.id for item in source_items]
        ).select_related("replaces", "bestiary_entry")
    }
    skipped = [version for version in versions.values() if version.generated_effect_key != effect_key]
    clone_map = {}
    for source in source_items:
        clone = versions.get(source.id, Item())
        if clone.pk is not None and clone.generated_effect_key != effect_key:
            continue  # a hand-made version: the rule leaves it alone
        clone_sync_fn(source, clone)
        clone_map[source.id] = clone

    stale_clones = Item.objects.filter(campaign_id=campaign_id, generated_effect_key=effect_key).exclude(
        replaces_id__in=list(clone_map)
    )
    _retire_clones(campaign_id, list(stale_clones.only("id", "replaces_id")))
    remap.remap(kinds.ITEMS, campaign_id, {source_id: clone.id for source_id, clone in clone_map.items()})
    bump(campaign_id, "items")  # its cached items list shows the clones (PERF-13), and members refetch it (BUG-80)
    return skipped


def sync_half_price_armour_for_campaign(campaign_id):
    def clone_sync_fn(source, clone):
        _clone_item_fields(source, clone, campaign_id, HALF_PRICE_ARMOUR_EFFECT_KEY)
        clone.save()
        _sync_property_links(source, clone)
        _sync_availabilities(source, clone, _half_price)

    return _sync_generated_items_for_campaign(
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

    return _sync_generated_items_for_campaign(
        campaign_id,
        effect_key=IMPROVED_SHIELDS_EFFECT_KEY,
        source_items=_prefetched_base_items("Shield"),
        clone_sync_fn=clone_sync_fn,
    )


def revert_improved_shields_for_campaign(campaign_id):
    _revert_generated_items_for_campaign(campaign_id, IMPROVED_SHIELDS_EFFECT_KEY)
