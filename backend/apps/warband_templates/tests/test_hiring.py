"""Hiring from the warband's template (the templates plan, phase 2): a roster Save's create naming a fighter is filled
from him (the variant applied) under what it sent, writes a Recruit row at the price sent and a Buy row per item at its
price, gives the "1st free" Dagger to every hire of a fighter whose lists have one (every member of a group, and a
member who joins later pays nothing for it), and an unknown fighter is refused; a unit typed by hand gets nothing."""

from typing import Any

from apps.items.tests.catalogue_support import ITEMS, SKILLS, CatalogueTestCase, make_entry
from apps.warband_templates.models import TemplateFighter, TemplateListItem
from apps.warbands.models import HenchmenGroup, Hero, LedgerAction, WarbandTrade

from .support import Made, make_template

ROSTER = "/api/warbands/{warband}/{kind}/batch/"


class HiringFromTheTemplateTests(CatalogueTestCase):
    made: Made
    dagger: Any

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.made = make_template("Mercenaries", item=cls.book_axe, race=cls.human, warband_type=cls.mercenaries)
        cls.dagger = make_entry(ITEMS, "Dagger", cost=2)
        TemplateListItem.objects.create(equipment_list=cls.made.kit, item=cls.dagger, cost=2, first_free=True)
        TemplateFighter.objects.filter(pk=cls.made.captain.pk).update(
            starting_xp=20,
            skill_types=["Combat", "Shooting"],
            spell_types=[{"name": "Lesser Magic", "note": ""}],
            caster="Wizard",
            is_leader=True,
            written_stats={"attacks": "(2)"},
            variant_changes={"middenheim": {"stats": {"strength": 4}}},
        )
        TemplateFighter.objects.filter(pk=cls.made.warriors.pk).update(starting_xp=0, gains_xp=False, promotable=False)

    def batch(self, kind: str, body: dict[str, Any]) -> Any:
        url = ROSTER.format(warband=self.warband.id, kind=kind)
        return self.post_as(self.player, url, body)

    def ledger(self) -> list[tuple[str, int, str]]:
        rows = WarbandTrade.objects.filter(warband=self.warband).exclude(action=LedgerAction.STARTING_GOLD)
        return list(rows.order_by("id").values_list("action", "price", "description"))

    def test_a_hero_is_filled_from_his_fighter_and_writes_what_the_tally_says(self) -> None:
        create = {"fighter_key": "captain", "name": "Ulrich", "price": 55}
        purchase = {"create_index": 0, "item_id": self.book_axe.id, "price": 4}
        response = self.batch("heroes", {"create": [create], "purchases": [purchase]})
        self.assertEqual(response.status_code, 200, response.data)
        hero = Hero.objects.get(warband=self.warband, name="Ulrich")
        self.assertEqual(
            (hero.fighter_key, hero.unit_type, hero.race_id, hero.price, hero.xp, hero.is_leader, hero.caster),
            ("captain", "Captain", self.human.id, 55, 20, True, "Wizard"),
        )
        self.assertEqual((hero.attacks, hero.written_stats, hero.strength), (1, {"attacks": "(2)"}, 3))
        self.assertEqual(
            (hero.available_skills, hero.available_spell_types), (["Combat", "Shooting"], ["Lesser Magic"])
        )
        self.assertEqual(set(hero.hero_specials.values_list("special__name", flat=True)), {"Leader", "Wizard"})
        self.assertEqual(sorted(hero.hero_items.values_list("item__name", "cost")), [("Axe", 4), ("Dagger", 0)])
        self.assertEqual(
            self.ledger(), [(LedgerAction.RECRUIT, -55, "Ulrich the Captain"), (LedgerAction.BUY, -4, "Axe")]
        )

    def test_the_variant_changes_him_and_what_is_sent_wins(self) -> None:
        self.warband.template_variant = "middenheim"
        self.warband.save()
        create = {"fighter_key": "captain", "name": "Otto", "unit_type": "Watch Captain", "xp": 0}
        self.assertEqual(self.batch("heroes", {"create": [create]}).status_code, 200)
        hero = Hero.objects.get(warband=self.warband, name="Otto")
        self.assertEqual((hero.strength, hero.unit_type, hero.xp, hero.price), (4, "Watch Captain", 0, 60))

    def test_a_hero_gets_the_skills_his_variant_gives_him(self) -> None:
        ride = make_entry(SKILLS, "Ride [Animal]")
        TemplateFighter.objects.filter(pk=self.made.captain.pk).update(
            variant_changes={"middenheim": {"skills": [{"id": ride.id, "name": "Ride [Animal]"}]}}
        )
        self.assertEqual(
            self.batch("heroes", {"create": [{"fighter_key": "captain", "name": "Karl"}]}).status_code, 200
        )
        self.assertEqual(list(Hero.objects.get(name="Karl").hero_skills.values_list("skill_id", flat=True)), [])
        self.warband.template_variant = "middenheim"
        self.warband.save()
        self.assertEqual(
            self.batch("heroes", {"create": [{"fighter_key": "captain", "name": "Otto"}]}).status_code, 200
        )
        self.assertEqual(list(Hero.objects.get(name="Otto").hero_skills.values_list("skill_id", flat=True)), [ride.id])

    def test_a_group_buys_one_loadout_and_every_member_gets_the_dagger(self) -> None:
        create = {"fighter_key": "warriors", "name": "Lads", "henchmen": [{"name": "A"}, {"name": "B"}]}
        purchase = {"create_index": 0, "item_id": self.book_axe.id, "price": 5}
        self.assertEqual(self.batch("henchmen-groups", {"create": [create], "purchases": [purchase]}).status_code, 200)
        group = HenchmenGroup.objects.get(warband=self.warband, name="Lads")
        self.assertEqual(
            (group.fighter_key, group.unit_type, group.price, group.max_size, group.no_level_ups, group.promotable),
            ("warriors", "Warrior", 25, 5, True, False),
        )
        self.assertEqual(
            sorted(group.henchmen_group_items.values_list("item__name", "cost")), [("Axe", 5), ("Dagger", 0)]
        )
        self.assertEqual(
            [(action, price) for action, price, _ in self.ledger()],
            [
                (LedgerAction.GROUP, 0),
                (LedgerAction.RECRUIT, -25),
                (LedgerAction.RECRUIT, -25),
                (LedgerAction.BUY, -10),
            ],
        )
        body = self.get_as(self.player, f"/api/warbands/{self.warband.id}/henchmen-groups/{group.id}/").json()
        self.assertEqual(body["hire_cost"], 30)  # a member who joins pays the group's price and the axe, not the dagger

    def test_no_list_no_priced_dagger_and_no_key_get_nothing_free(self) -> None:
        TemplateListItem.objects.filter(item=self.dagger).update(first_free=False)
        self.assertEqual(self.batch("heroes", {"create": [{"fighter_key": "captain", "name": "A"}]}).status_code, 200)
        self.assertEqual(self.batch("heroes", {"create": [{"name": "Typed", "unit_type": "Captain"}]}).status_code, 200)
        self.assertFalse(Hero.objects.filter(warband=self.warband, hero_items__isnull=False).exists())
        self.assertEqual(Hero.objects.get(name="Typed").fighter_key, "")

    def test_an_unknown_fighter_or_a_henchman_as_a_hero_is_refused(self) -> None:
        for key in ("nobody", "warriors"):
            response = self.batch("heroes", {"create": [{"fighter_key": key, "name": "X"}]})
            self.assertEqual(response.status_code, 400)
            self.assertEqual(
                response.json()["fields"]["create.0.fighter_key"], ["Not one of this warband's template heroes."]
            )
        self.assertFalse(Hero.objects.filter(warband=self.warband).exists())

    def test_a_single_create_from_the_template_is_filled_too(self) -> None:
        url = f"/api/warbands/{self.warband.id}/heroes/"
        response = self.post_as(self.player, url, {"fighter_key": "captain", "name": "Solo"})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual((response.data["unit_type"], response.data["fighter_key"]), ("Captain", "captain"))
        self.assertEqual([item["name"] for item in response.data["items"]], ["Dagger"])
