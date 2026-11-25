"""Workshops on the catalogue tests' small book (CatalogueTestCase): the book template "Merchant Caravans" serving the
Mercenaries (a Captain and Warriors, a kit list selling the Axe, a rule and an upgrade, both the template's own
specials), and a fully kitted roster written directly, one row in every table a warband owns."""

from typing import Any

from apps.campaigns.models import Campaign, CampaignType
from apps.items.tests.catalogue_support import CatalogueTestCase
from apps.skills.models import Skill
from apps.special.models import Special
from apps.warband_templates.tests.support import Made, make_template
from apps.warbands.models import (
    Henchman,
    HenchmanItemGap,
    HenchmenGroup,
    HenchmenGroupItem,
    HenchmenGroupSkill,
    HenchmenGroupSpecial,
    Hero,
    HeroItem,
    HeroSkill,
    HeroSpecial,
    HeroSpell,
    Hireling,
    HirelingItem,
    HirelingSkill,
    HirelingSpecial,
    HirelingSpell,
    Warband,
    WarbandItem,
    WarbandRule,
)


class WorkshopTestCase(CatalogueTestCase):
    made: Made
    khemri: CampaignType

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.made = make_template("Merchant Caravans", item=cls.book_axe, race=cls.human, warband_type=cls.mercenaries)
        cls.khemri = CampaignType.objects.create(slug="khemri-test", name="Khemri (test)", grade="1b", sort_order=50)

    # Requests

    def make_warband_workshop(self, user: Any = None, **body: Any) -> Any:
        sent = {"name": "The Gilded Wagon", "warband_type_id": self.mercenaries.id, **body}
        response = self.post_as(user or self.player, "/api/workshop/warbands/", sent)
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def make_list_workshop(self, user: Any = None, **body: Any) -> Any:
        response = self.post_as(user or self.player, "/api/workshop/lists/", {"name": "Night Watch", **body})
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def workshop(self, row: dict[str, Any]) -> Campaign:
        return Campaign.objects.get(pk=row["id"])

    def warband_of(self, row: dict[str, Any]) -> Warband:
        return Warband.objects.select_related("campaign", "campaign__settings").get(pk=row["warband_id"])


def kit_out(
    warband: Warband,
    *,
    human: Any,
    axe: Any,
    sword: Any,
    skill: Skill,
    special: Special,
    spell: Any,
    stash_cost: int = 10,
) -> None:
    """One row in every table a warband owns, and a dead hero, a dismissed group and a dead member to leave behind;
    its cost: hero 60 + axe 5, hireling 80 + sword 10, group 25 x 2 members + axe 5 x (2 - 1 gap), stash 10 x 3 = 240."""
    WarbandRule.objects.create(warband=warband, title="Hard Bargains", description="Haggle.")
    WarbandItem.objects.create(warband=warband, item=sword, cost=stash_cost, quantity=3)
    hero = Hero.objects.create(
        warband=warband,
        name="Gunther",
        unit_type="Captain",
        race=human,
        price=60,
        xp=8,
        is_leader=True,
        fighter_key="captain",
        available_skills={"Combat": True},
        pending_skills=1,
        notes="Grim.",
        movement=4,
        written_stats={"attacks": "(2)"},
        level_up_history=[{"xp": 4, "roll": "11"}],
    )
    HeroItem.objects.create(hero=hero, item=axe, cost=5, shown_as="Hatchet")
    HeroSkill.objects.create(hero=hero, skill=skill)
    HeroSpecial.objects.create(hero=hero, special=special)
    HeroSpell.objects.create(hero=hero, spell=spell, dc_change=-1)
    Hero.objects.create(warband=warband, name="Fallen", price=35, dead=True)
    hireling = Hireling.objects.create(warband=warband, name="Ogre", price=80, rating=12, race=human)
    HirelingItem.objects.create(hireling=hireling, item=sword, cost=10)
    HirelingSkill.objects.create(hireling=hireling, skill=skill)
    HirelingSpecial.objects.create(hireling=hireling, special=special)
    HirelingSpell.objects.create(hireling=hireling, spell=spell)
    group = HenchmenGroup.objects.create(
        warband=warband, name="Warriors", unit_type="Warrior", race=human, price=25, fighter_key="warriors"
    )
    alpha, beta = (Henchman.objects.create(group=group, name=name) for name in ("Alpha", "Beta"))
    Henchman.objects.create(group=group, name="Gone", dead=True)
    row = HenchmenGroupItem.objects.create(henchmen_group=group, item=axe, cost=5)
    HenchmanItemGap.objects.create(henchman=beta, group_item=row, reason=HenchmanItemGap.LOST)
    HenchmenGroupSkill.objects.create(henchmen_group=group, skill=skill)
    HenchmenGroupSpecial.objects.create(henchmen_group=group, special=special)
    HenchmenGroup.objects.create(warband=warband, name="Deserters", price=20, dismissed_at="2026-11-01T00:00:00Z")
    assert alpha.pk


KIT_COST = 240
