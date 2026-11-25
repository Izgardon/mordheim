"""Raising a warband from its type's template, and keeping its variant and rules in step with it (the templates plan,
phase 2).

Raising stays one step and hires nobody: the warband gets the campaign's gold plus the template's difference from 500
(payload.raise_gold), the template's most warriors, its variant (the type's preset, else the one picked) and a copy of
the template's rules for that variant, in the book's order. A type with no template raises as before. Later the
variant or the type can change in Settings, which swaps the untouched copies of the old one's rules for the new one's
(rule_swap.py), and "Add missing rules" copies the rules whose title the warband lacks; a later change to the
template touches none of it. The campaign's preset's
warband rules for the warband's type or race follow the template's on both (apps/campaign_presets).
"""

from collections.abc import Iterable, MutableMapping
from typing import Any

from django.db import transaction
from rest_framework import serializers

from apps.campaign_presets.models import CampaignPreset
from apps.campaign_presets.services.resources import give_fixed, other_resources
from apps.campaign_presets.services.warband_rules import copy_warband_rules
from apps.campaigns.models import DEFAULT_RESOURCE_NAME, CampaignSettings
from apps.warbands.models import LedgerAction, Warband, WarbandResource, WarbandRule, WarbandType
from apps.warbands.services import ledger
from apps.warbands.services.plot_rules import sync_plot_rules

from ..models import WarbandTemplate
from .payload import raise_gold
from .resolve import template_for_type, template_size, variant_keys, variant_rules, warband_variant

UNKNOWN_VARIANT = "Not one of this warband type's variants."
NO_VARIANT = "Pick one of this warband type's variants."


def picked_variant(template: WarbandTemplate | None, sent: str) -> str:
    """The variant a warband is raised as: its type's preset, else the one sent, which must be one of the template's
    (a 400 otherwise, and for none when the template has variants: William's one block on raising, 5 Nov); blank
    without a template."""
    if template is None:
        return ""
    preset = str(getattr(template, "preset_variant", "") or "")
    if preset:
        return preset
    keys = variant_keys(template)
    if keys and not sent:
        raise serializers.ValidationError({"template_variant": [NO_VARIANT]})
    if sent and sent not in keys:
        raise serializers.ValidationError({"template_variant": [UNKNOWN_VARIANT]})
    return sent


def settle_variant(warband: Warband, validated: MutableMapping[str, Any]) -> None:
    """An edit's variant (Settings): one sent must be one of the template's (blank: none); a new type that sends none
    takes the new type's preset, else keeps the variant if the new template has it (one query, only then)."""
    sent_type = validated.get("warband_type")
    type_changed = sent_type is not None and sent_type.pk != warband.warband_type_id
    if "template_variant" not in validated and not type_changed:
        return
    type_id = sent_type.pk if sent_type is not None else warband.warband_type_id
    template = template_for_type(warband.campaign_id, type_id)
    if "template_variant" in validated:
        sent = validated["template_variant"]
        if sent and (template is None or sent not in variant_keys(template)):
            raise serializers.ValidationError({"template_variant": [UNKNOWN_VARIANT]})
        return
    if template is None:
        validated["template_variant"] = ""
        return
    preset = str(getattr(template, "preset_variant", "") or "")
    kept = warband.template_variant if warband.template_variant in variant_keys(template) else ""
    validated["template_variant"] = preset or kept


def copy_rules(warband: Warband, template: WarbandTemplate, variant: str, *, missing_only: bool = False) -> int:
    """Copy the template's rules for the variant onto the warband's, in order (one INSERT); `missing_only`: just those
    whose title the warband has no rule of (one more query). How many were copied."""
    rules = variant_rules(template.rules.all(), variant, warband.warband_type_id)
    if missing_only:
        have = {title.strip().lower() for title in warband.rules.values_list("title", flat=True)}
        rules = [rule for rule in rules if rule.title.strip().lower() not in have]
    WarbandRule.objects.bulk_create(
        WarbandRule(warband=warband, title=rule.title, description=rule.description) for rule in rules
    )
    return len(rules)


def add_template_rules(warband: Warband) -> int:
    """Add missing rules (the rules modal): the warband's template's rules for its variant whose title it
    lacks, then its campaign's preset's warband rules for it whose title it still lacks (William, 23 Nov 2026). How
    many were copied."""
    template = template_for_type(warband.campaign_id, warband.warband_type_id)
    added = 0
    if template is not None:
        added = copy_rules(warband, template, warband_variant(warband, template), missing_only=True)
    return added + copy_warband_rules(warband, warband.campaign.preset_id, missing_only=True)


def raise_warband(campaign_id: int, user: Any, fields: dict[str, Any], counts_as: Iterable[WarbandType]) -> Warband:
    """Raise the user's warband in the campaign from validated fields (its `warband_type` found, its plot checked),
    all or nothing: its type's template gives its variant, most warriors, gold and rules (`open_treasury`), then its
    preset's rules for its type or race and the plot rungs it has reached."""
    template = template_for_type(campaign_id, fields["warband_type"].pk)
    variant = picked_variant(template, fields.pop("template_variant", ""))
    if template is not None:
        fields.setdefault("max_units", template_size(template, variant))
    with transaction.atomic():
        warband = Warband.objects.create(campaign_id=campaign_id, user=user, template_variant=variant, **fields)
        warband.counts_as.set(counts_as)
        preset = open_treasury(warband, template, variant)
        if template is not None:
            copy_rules(warband, template, variant)
        # then its preset's rules for its type or race (William, 23 Nov 2026: Karak Azgal's Dwarf drunks)
        copy_warband_rules(warband, preset.pk if preset else None)
        sync_plot_rules(warband)  # the rungs it has reached, after those rules (apps/plots)
    return warband


def open_treasury(warband: Warband, template: WarbandTemplate | None, variant: str) -> CampaignPreset | None:
    """What a new warband starts with, in the caller's transaction: its default resource (named as the campaign
    names it), its campaign's preset's fixed counters and its Starting Gold ledger row (the campaign's gold plus the
    template's difference from 500); a raised warband and an imported one alike (apps/workshop). Its campaign's
    preset, for the caller's rules."""
    # locked: a rename of the default resource reaches this warband too, before or after (one at a time)
    settings = CampaignSettings.objects.select_for_update().filter(campaign_id=warband.campaign_id).first()
    # the one everyone starts with (William, 3 Nov 2026), named as the campaign names it
    name = settings.default_resource_name if settings else DEFAULT_RESOURCE_NAME
    WarbandResource.objects.create(warband=warband, name=name, amount=0, is_default=True)
    # and the counters its campaign's preset keeps for every warband (Marienburg's Wyrdstone)
    preset = CampaignPreset.objects.filter(campaigns__id=warband.campaign_id).first()
    give_fixed([warband], other_resources(preset))
    starting_gold = raise_gold(abs(settings.starting_gold) if settings else 500, template, variant)
    ledger.record(warband, LedgerAction.STARTING_GOLD, starting_gold, "Starting Gold")
    return preset
