"""A preset's warband rules on a warband (William, 23 Nov 2026): the rules of the published campaign its campaign plays
that are for its type or one of its groups, copied into its own rules (`WarbandRule`), where the player edits or
deletes them like any other. Nothing shows in a campaign playing another preset, or none.

A rule is for a warband when it names the warband's own type or a group holding that type. The types it counts as
never bring one, as they never pick its template (warband_templates/services/resolve.py): these are rules of the
warband's list, as its template's are.
"""

from collections.abc import Collection

from django.db.models import Q

from apps.warbands.models import Warband, WarbandRule

from ..models import CampaignPresetWarbandRule


def warband_rules_for(preset_id: int | None, warband_type_id: int | None) -> list[CampaignPresetWarbandRule]:
    """The preset's warband rules for that type, in the book's order (one query; none without a preset or a type)."""
    if preset_id is None or warband_type_id is None:
        return []
    found = CampaignPresetWarbandRule.objects.filter(preset_id=preset_id).filter(
        Q(warband_types=warband_type_id) | Q(warband_groups__members=warband_type_id)
    )
    return list(found.distinct().order_by("order", "id"))


def folded(title: str) -> str:
    """A title as two rules are compared by: "Dwarf drunks" is " dwarf Drunks"."""
    return title.strip().lower()


def missing_warband_rules(
    warband: Warband, preset_id: int | None, have: Collection[str]
) -> list[CampaignPresetWarbandRule]:
    """Those whose title is not in `have` (folded titles: the warband's own, and any about to be added)."""
    return [rule for rule in warband_rules_for(preset_id, warband.warband_type_id) if folded(rule.title) not in have]


def copy_warband_rules(warband: Warband, preset_id: int | None, *, missing_only: bool = False) -> int:
    """Copy the preset's warband rules for the warband onto its own, in order (one INSERT); `missing_only`: just those
    whose title it has no rule of (one more query). How many were copied."""
    if preset_id is None:
        return 0
    if missing_only:
        have = {folded(title) for title in warband.rules.values_list("title", flat=True)}
        rules = missing_warband_rules(warband, preset_id, have)
    else:
        rules = warband_rules_for(preset_id, warband.warband_type_id)
    WarbandRule.objects.bulk_create(
        WarbandRule(warband=warband, title=rule.title, description=rule.text) for rule in rules
    )
    return len(rules)
