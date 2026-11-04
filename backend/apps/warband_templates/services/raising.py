"""Raising a warband from its type's template, and keeping its variant and rules in step with it (the templates plan,
phase 2).

Raising stays one step and hires nobody: the warband gets the campaign's gold plus the template's difference from 500
(payload.raise_gold), the template's most warriors, its variant (the type's preset, else the one picked) and a copy of
the template's rules for that variant, in the book's order. A type with no template raises as before. Later the
variant can change in Settings, and "Add the template's rules" copies the rules whose title the warband lacks; nothing
is ever removed for the player, and a later change to the template touches none of it.
"""

from collections.abc import MutableMapping
from typing import Any

from rest_framework import serializers

from apps.warbands.models import Warband, WarbandRule

from ..models import WarbandTemplate
from .resolve import template_for_type, variant_keys, variant_rules, warband_variant

UNKNOWN_VARIANT = "Not one of this warband type's variants."


def picked_variant(template: WarbandTemplate | None, sent: str) -> str:
    """The variant a warband is raised as: its type's preset, else the one sent, which must be one of the template's
    (a 400 otherwise); blank without a template."""
    if template is None:
        return ""
    preset = str(getattr(template, "preset_variant", "") or "")
    if preset:
        return preset
    if sent and sent not in variant_keys(template):
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
    """Add the template's rules (the rules modal): the warband's template's rules for its variant whose title it
    lacks; 0 when it has no template."""
    template = template_for_type(warband.campaign_id, warband.warband_type_id)
    if template is None:
        return 0
    return copy_rules(warband, template, warband_variant(warband, template), missing_only=True)
