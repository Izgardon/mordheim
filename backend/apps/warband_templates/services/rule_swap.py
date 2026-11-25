"""A warband's rules following a change of its variant or type in Settings (William, 25 Nov 2026: "Changing warband
subtype like for mercenaries doesn't change the warband rules").

What it was given before is what raising would have copied for the old type and variant: its template's rules for them
(raising.copy_rules), then its campaign preset's warband rules for the old type or a group holding it
(campaign_presets/services/warband_rules.py); what it is given after, the same for the new ones. A rule of the warband
that is still an exact copy of one it was given before (title and text, stripped) and that the new ones don't hold
again is taken out; one the player edited or wrote stays, named in the answer as kept, and a plot's rule
(`from_plot`) is never touched. Then the new ones it was not given before are added where it lacks their title, the
template's first in its order, then the preset's: a rule both give that the player deleted stays deleted (Add missing
rules still offers it). Nothing the player wrote is lost.
"""

from dataclasses import dataclass, field

from apps.campaign_presets.services.warband_rules import folded, warband_rules_for
from apps.warbands.models import Warband, WarbandRule

from ..models import WarbandTemplate
from .resolve import templates_for_type, variant_rules

Given = tuple[str, str]  # a rule as it is compared: its title and its text, stripped


@dataclass
class RuleSwap:
    """What a change of variant or type did to the warband's rules: the rules it now has, in order, the titles added,
    how many were taken out, and the titles of edited rules kept from before."""

    rules: list[WarbandRule]
    added: list[str] = field(default_factory=list)
    removed: int = 0
    kept: list[str] = field(default_factory=list)

    def words(self) -> list[str]:
        """What happened, in the server's words, for the page to show (none when nothing did)."""
        lines = [_counted(len(self.added), self.removed)] if self.added or self.removed else []
        return lines + [f"Kept your edited rule: {title}." for title in self.kept]


def _plural(count: int) -> str:
    return f"{count} rule" if count == 1 else f"{count} rules"


def _counted(added: int, removed: int) -> str:
    if added and removed:
        return f"Added {_plural(added)} and removed {removed}."
    return f"Added {_plural(added)}." if added else f"Removed {_plural(removed)}."


def _template(campaign_id: int, warband_type_id: int | None) -> WarbandTemplate | None:
    """The type's template with its rules (two queries; none without a type)."""
    return templates_for_type(campaign_id, warband_type_id).prefetch_related("rules").first()


def given_rules(
    template: WarbandTemplate | None, variant: str, warband_type_id: int | None, preset_id: int | None
) -> list[Given]:
    """What raising gives a warband of the type in the variant: the template's rules for them, then the preset's."""
    found: list[Given] = []
    if template is not None:
        read = variant or str(getattr(template, "preset_variant", "") or "")  # as resolve.warband_variant reads it
        found += [(rule.title, rule.description) for rule in variant_rules(template.rules.all(), read, warband_type_id)]
    found += [(rule.title, rule.text) for rule in warband_rules_for(preset_id, warband_type_id)]
    return [(title.strip(), text.strip()) for title, text in found]


def swap_rules(warband: Warband, old_type_id: int | None, old_variant: str) -> RuleSwap | None:
    """Swap the old type's and variant's rules for the new ones (the warband saved with its new type and variant);
    None when neither changed. A fixed number of queries, whatever the rules' number."""
    new_type_id = warband.warband_type_id
    if new_type_id == old_type_id and warband.template_variant == old_variant:
        return None
    preset_id = warband.campaign.preset_id
    old_template = _template(warband.campaign_id, old_type_id)
    same_type = new_type_id == old_type_id
    new_template = old_template if same_type else _template(warband.campaign_id, new_type_id)
    before = given_rules(old_template, old_variant, old_type_id, preset_id)
    after = given_rules(new_template, warband.template_variant, new_type_id, preset_id)
    return _apply(warband, before, after)


def _given(rule: WarbandRule) -> Given:
    return rule.title.strip(), rule.description.strip()


def _apply(warband: Warband, before: list[Given], after: list[Given]) -> RuleSwap:
    """Take out the untouched copies of what goes, note the edited ones kept, add what comes whose title it lacks."""
    was, now = set(before), set(after)
    going = was - now
    going_titles = {folded(title) for title, _ in going}
    rules = list(warband.rules.all())
    own = [rule for rule in rules if rule.from_plot_id is None]
    out_ids = {rule.pk for rule in own if _given(rule) in going}
    stays = [rule for rule in rules if rule.pk not in out_ids]
    kept = [
        rule.title
        for rule in own
        if rule.pk not in out_ids and _given(rule) not in now and folded(rule.title) in going_titles
    ]
    if out_ids:
        WarbandRule.objects.filter(pk__in=out_ids).delete()
    have = {folded(rule.title) for rule in stays}
    adding: list[WarbandRule] = []
    for title, text in after:
        if (title, text) not in was and folded(title) not in have:
            have.add(folded(title))
            adding.append(WarbandRule(warband=warband, title=title, description=text))
    created = WarbandRule.objects.bulk_create(adding)
    return RuleSwap(rules=stays + created, added=[rule.title for rule in created], removed=len(out_ids), kept=kept)
