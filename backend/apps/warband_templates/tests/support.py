"""A small warband template with one of every child row, for the catalogue and API tests."""

from dataclasses import dataclass
from typing import Any

from apps.campaigns.models import Campaign
from apps.items.models import Item
from apps.races.models import Race
from apps.special.kinds import WARBAND
from apps.special.models import Special
from apps.warband_templates.models import (
    HENCHMAN,
    HERO,
    TemplateFighter,
    TemplateFighterList,
    TemplateFighterSpecial,
    TemplateList,
    TemplateListItem,
    TemplateRule,
    TemplateUpgrade,
    WarbandTemplate,
    WarbandTemplateType,
)
from apps.warbands.models import WarbandType

PROFILE = {
    "movement": 4,
    "weapon_skill": 4,
    "ballistic_skill": 3,
    "strength": 3,
    "toughness": 3,
    "wounds": 1,
    "initiative": 3,
    "attacks": 1,
    "leadership": 7,
}


@dataclass
class Made:
    template: WarbandTemplate
    captain: TemplateFighter
    warriors: TemplateFighter
    kit: TemplateList
    line: TemplateListItem
    rule: Special
    mutation: Special


def make_template(
    name: str, *, item: Item, race: Race, warband_type: WarbandType, campaign: Campaign | None = None, **fields: Any
) -> Made:
    """A template serving `warband_type`: a Leader captain of `race` and a henchmen group, one list holding `item`
    (both buy from it), a warband rule for every variant and one for Reikland's, and one upgrade."""
    template = WarbandTemplate.objects.create(
        name=name,
        slug=name.lower().replace(" ", "-"),
        campaign=campaign,
        starting_gold=500,
        variants=[{"key": "reikland", "name": "Reikland"}, {"key": "middenheim", "name": "Middenheim"}],
        **fields,
    )
    WarbandTemplateType.objects.create(
        template=template, campaign=campaign, warband_type=warband_type, variant="reikland"
    )
    TemplateRule.objects.create(template=template, position=0, title="Hard Bargains", description="Haggle.")
    TemplateRule.objects.create(template=template, position=1, title="Marksmen", variant="reikland")
    kit = TemplateList.objects.create(template=template, key="kit", name="Kit list", note="Everyone")
    line = TemplateListItem.objects.create(equipment_list=kit, item=item, cost=5, shown_as="Hatchet")
    captain = TemplateFighter.objects.create(
        template=template, key="captain", position=0, kind=HERO, name="Captain", race=race, cost=60, **PROFILE
    )
    warriors = TemplateFighter.objects.create(
        template=template,
        key="warriors",
        position=1,
        kind=HENCHMAN,
        name="Warrior",
        plural="Warriors",
        race=race,
        cost=25,
        group_min=1,
        group_max=5,
        **PROFILE,
    )
    rule = Special.objects.create(name="Leader", type=f"Warband - {name}", owner_kind=WARBAND, campaign=campaign)
    mutation = Special.objects.create(name="Tentacle", type=f"Warband - {name}", owner_kind=WARBAND, campaign=campaign)
    TemplateFighterSpecial.objects.create(fighter=captain, special=rule)
    for fighter in (captain, warriors):
        TemplateFighterList.objects.create(fighter=fighter, equipment_list=kit)
    TemplateUpgrade.objects.create(template=template, group="Mutations", special=mutation, cost=35)
    return Made(template, captain, warriors, kit, line, rule, mutation)
