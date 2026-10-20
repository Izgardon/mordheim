"""House rules with an item effect (BUG-52, PERF-44; CAMP-TEST-14, -18).

A rule's `effect_key` (half-price armour, improved shields) clones items into the campaign (apps/items/services.py).
The effects are `effects.EFFECTS`; each has its sync and revert here. A campaign has at most one rule per effect (a partial unique index), so creating it again, even twice at once,
answers the rule that exists instead of a second rule and a second set of clones. An edit that keeps the effect
(a title or a description) leaves the clones alone; only a change of effect reverts the old one and syncs the new.
"""

from typing import Any

from django.db import IntegrityError, transaction

from apps.items.services import (
    HALF_PRICE_ARMOUR_EFFECT_KEY,
    IMPROVED_SHIELDS_EFFECT_KEY,
    revert_half_price_armour_for_campaign,
    revert_improved_shields_for_campaign,
    sync_half_price_armour_for_campaign,
    sync_improved_shields_for_campaign,
)

from ..errors import Refused
from ..models import CampaignHouseRule

UNIQUE_EFFECT = "campaign_house_rule_unique_effect"
SYNCS = {
    HALF_PRICE_ARMOUR_EFFECT_KEY: sync_half_price_armour_for_campaign,
    IMPROVED_SHIELDS_EFFECT_KEY: sync_improved_shields_for_campaign,
}
REVERTS = {
    HALF_PRICE_ARMOUR_EFFECT_KEY: revert_half_price_armour_for_campaign,
    IMPROVED_SHIELDS_EFFECT_KEY: revert_improved_shields_for_campaign,
}


def sync_effect(campaign_id: int, effect_key: str | None) -> None:
    sync = SYNCS.get(effect_key or "")
    if sync:
        sync(campaign_id)


def resync_every_campaign() -> int:
    """Sync every campaign's item-effect rules again, through the one repricing path, and return how many (BUG-51:
    a clone copies its book armour once, so `seed_items` calls this after a reseed reprices the book)."""
    rules = CampaignHouseRule.objects.exclude(effect_key__isnull=True).exclude(effect_key="")
    pairs = list(rules.values_list("campaign_id", "effect_key").distinct().order_by("campaign_id", "effect_key"))
    for campaign_id, effect_key in pairs:
        sync_effect(campaign_id, effect_key)
    return len(pairs)


def revert_effect_if_unused(campaign_id: int, effect_key: str | None) -> None:
    """Undo an effect's clones once no rule of the campaign has it."""
    revert = REVERTS.get(effect_key or "")
    if revert and not CampaignHouseRule.objects.filter(campaign_id=campaign_id, effect_key=effect_key).exists():
        revert(campaign_id)


def rules(campaign_id: int):
    return CampaignHouseRule.objects.filter(campaign_id=campaign_id).order_by("created_at")


def _rule_with_effect(campaign_id: int, effect_key: str) -> CampaignHouseRule | None:
    return CampaignHouseRule.objects.filter(campaign_id=campaign_id, effect_key=effect_key).first()


def create_rule(campaign_id: int, validated: dict[str, Any]) -> tuple[CampaignHouseRule, bool]:
    """The new rule and True, or the campaign's existing rule with that effect and False (BUG-52)."""
    effect_key = validated.get("effect_key") or ""
    existing = _rule_with_effect(campaign_id, effect_key) if effect_key else None
    if existing:
        return existing, False
    try:
        with transaction.atomic():
            rule = CampaignHouseRule.objects.create(campaign_id=campaign_id, **validated)
            sync_effect(campaign_id, rule.effect_key)
    except IntegrityError as error:  # the same effect created at the same moment: the first one stands
        if UNIQUE_EFFECT not in str(error):
            raise
        existing = _rule_with_effect(campaign_id, effect_key)
        assert existing is not None
        return existing, False
    return rule, True


def update_rule(rule: CampaignHouseRule, validated: dict[str, Any]) -> CampaignHouseRule:
    """Apply an edit; the clones change only when the effect does (PERF-44)."""
    previous = rule.effect_key or ""
    for field, value in validated.items():
        setattr(rule, field, value)
    if (rule.effect_key or "") == previous:
        rule.save(update_fields=[*validated, "updated_at"])
        return rule
    try:
        with transaction.atomic():
            rule.save()
            revert_effect_if_unused(rule.campaign_id, previous)
            sync_effect(rule.campaign_id, rule.effect_key)
    except IntegrityError as error:
        if UNIQUE_EFFECT not in str(error):
            raise
        raise Refused("This campaign already has a house rule with that effect.", code="duplicate_effect") from error
    return rule


def delete_rule(rule: CampaignHouseRule) -> None:
    """Delete the rule; its effect's clones go once no other rule of the campaign has it."""
    effect_key = rule.effect_key
    with transaction.atomic():
        rule.delete()
        revert_effect_if_unused(rule.campaign_id, effect_key)
