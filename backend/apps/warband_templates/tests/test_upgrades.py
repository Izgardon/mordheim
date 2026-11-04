"""Upgrades bought onto a hero (the templates plan, phase 3): a roster Save's `upgrades` links each upgrade's special to
its hero (the hire dialog's for the hero it creates, the store's for one on the roster) and writes a Buy row at the
price sent (none at 0 gc; two or more under a Group header), logged as a special he gained; an upgrade of another
template, or one for a group, is refused; gold below 0 warns; the queries grow with the upgrades, not the roster."""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.core.testing import book_warband_type
from apps.items.tests.catalogue_support import CatalogueTestCase
from apps.special.kinds import WARBAND
from apps.special.models import Special
from apps.warband_templates.models import TemplateUpgrade
from apps.warbands.models import HenchmenGroup, Hero, LedgerAction, Warband, WarbandLog, WarbandTrade

from .support import Made, make_template

ROSTER = "/api/warbands/{warband}/{kind}/batch/"


class UpgradeTests(CatalogueTestCase):
    made: Made
    claw: TemplateUpgrade
    mark: TemplateUpgrade

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.made = make_template("Mercenaries", item=cls.book_axe, race=cls.human, warband_type=cls.mercenaries)
        TemplateUpgrade.objects.filter(template=cls.made.template).update(later_double=True, at_recruit=True)
        claw = Special.objects.create(name="Great Claw", type="Warband - Mercenaries", owner_kind=WARBAND)
        cls.claw = TemplateUpgrade.objects.create(template=cls.made.template, group="Mutations", special=claw, cost=50)
        mark = Special.objects.create(name="Mark of Tchar", type="Warband - Mercenaries", owner_kind=WARBAND)
        cls.mark = TemplateUpgrade.objects.create(
            template=cls.made.template, group="Mark of the Dark Gods", special=mark, cost=0, max_per_fighter=1
        )

    def batch(self, body: dict[str, Any], kind: str = "heroes") -> Any:
        return self.post_as(self.player, ROSTER.format(warband=self.warband.id, kind=kind), body)

    def ledger(self) -> list[tuple[str, int, str]]:
        rows = WarbandTrade.objects.filter(warband=self.warband).exclude(action=LedgerAction.STARTING_GOLD)
        return list(rows.order_by("id").values_list("action", "price", "description"))

    def specials(self, hero: Hero) -> set[str]:
        return set(hero.hero_specials.values_list("special__name", flat=True))

    def test_a_hire_buys_its_upgrades_at_the_tallys_prices(self) -> None:
        tentacle = self.made.template.upgrades.get(special=self.made.mutation)
        upgrades = [
            {"create_index": 0, "upgrade_id": self.claw.id, "price": 50},
            {"create_index": 0, "upgrade_id": tentacle.id, "price": 70},
        ]
        response = self.batch({"create": [{"fighter_key": "captain", "name": "Kurt"}], "upgrades": upgrades})
        self.assertEqual(response.status_code, 200, response.data)
        hero = Hero.objects.get(warband=self.warband, name="Kurt")
        self.assertEqual(self.specials(hero), {"Leader", "Great Claw", "Tentacle"})
        self.assertEqual(
            self.ledger(),
            [
                (LedgerAction.RECRUIT, -60, "Kurt the Captain"),
                (LedgerAction.GROUP, 0, "Upgraded Kurt (2 upgrades, 120 gc)"),
                (LedgerAction.BUY, -50, "Great Claw"),
                (LedgerAction.BUY, -70, "Tentacle"),
            ],
        )
        logged = WarbandLog.objects.filter(warband=self.warband, entry_type="hero_special").values_list(
            "payload", flat=True
        )
        self.assertIn(
            {"hero": "Kurt", "special": "Tentacle", "special_type": "Warband - Mercenaries", "price": 70}, list(logged)
        )

    def test_the_store_buys_one_for_a_hero_on_the_roster_and_a_free_one_writes_no_row(self) -> None:
        hero = Hero.objects.create(warband=self.warband, name="Ulf", fighter_key="captain")
        upgrade = {"unit_id": hero.id, "upgrade_id": self.mark.id, "price": 0}
        response = self.batch({"upgrades": [upgrade]})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.specials(hero), {"Mark of Tchar"})
        self.assertEqual(self.ledger(), [])
        response = self.batch({"upgrades": [{**upgrade, "upgrade_id": self.claw.id, "price": 100}]})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.ledger(), [(LedgerAction.BUY, -100, "Great Claw")])
        self.warband.refresh_from_db()
        self.assertEqual(self.warband.gold, 400)

    def test_gold_below_zero_warns_and_the_upgrade_is_bought(self) -> None:
        Warband.objects.filter(pk=self.warband.pk).update(gold=20)
        hero = Hero.objects.create(warband=self.warband, name="Ulf")
        response = self.batch({"upgrades": [{"unit_id": hero.id, "upgrade_id": self.claw.id, "price": 50}]})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([warning["code"] for warning in response.data["warnings"]], ["gold_negative"])
        self.assertEqual(response.data["warnings"][0]["gold"], -30)

    def test_another_templates_upgrade_a_group_and_a_stranger_are_refused(self) -> None:
        other = make_template("Skaven", item=self.book_axe, race=self.human, warband_type=book_warband_type("Skaven"))
        foreign = other.template.upgrades.get()
        hero = Hero.objects.create(warband=self.warband, name="Ulf")
        response = self.batch({"upgrades": [{"unit_id": hero.id, "upgrade_id": foreign.id, "price": 5}]})
        self.assertEqual(response.status_code, 400)
        self.assertIn("upgrades.0.upgrade_id", response.json()["fields"])
        group = HenchmenGroup.objects.create(warband=self.warband, name="Lads")
        response = self.batch(
            {"upgrades": [{"unit_id": group.id, "upgrade_id": self.claw.id, "price": 5}]}, "henchmen-groups"
        )
        self.assertEqual(
            (response.status_code, response.json()["fields"]), (400, {"upgrades": ["Upgrades are bought for heroes."]})
        )
        rival = Hero.objects.create(warband=self.rival_warband, name="Rat")
        response = self.batch({"upgrades": [{"unit_id": rival.id, "upgrade_id": self.claw.id, "price": 5}]})
        self.assertIn("upgrades.0.unit_id", response.json()["fields"])
        self.assertEqual(self.ledger(), [])

    def test_the_queries_grow_with_the_upgrades_not_the_roster(self) -> None:
        def buy(name: str) -> int:
            hero = Hero.objects.create(warband=self.warband, name=name, fighter_key="captain")
            self.client.force_authenticate(user=self.player)
            body = {"upgrades": [{"unit_id": hero.id, "upgrade_id": self.claw.id, "price": 50}]}
            with CaptureQueriesContext(connection) as captured:
                response = self.client.post(ROSTER.format(warband=self.warband.id, kind="heroes"), body, format="json")
            self.assertEqual(response.status_code, 200)
            return len(captured)

        first = buy("First")
        for number in range(4):
            Hero.objects.create(warband=self.warband, name=f"Extra {number}").hero_specials.create(
                special=self.made.rule
            )
        self.assertEqual(buy("Second"), first)
