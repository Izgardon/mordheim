"""The hired sword and dramatis persona form's writes (William, 7 Nov 2026): a fee is gold, dice and at most one
resource on top ("only 1 resource should be allowed"), never gold as a resource; an upkeep never takes a hero's place
("it should never be an option in upkeep") and one who takes a hero's place keeps none; a stored fee the form can't
hold (several resources) loads as it is and stays while a write leaves it out; and a race added from the form ("a
Add new button that shows a form with name and stat entry") is the campaign's and names the entry."""

from typing import Any

from apps.hirelings.fees import make_fee
from apps.hirelings.models import HiredSword
from apps.items.tests.catalogue_support import DRAMATIS_PERSONAE, HIRED_SWORDS, RACES, CatalogueTestCase, make_entry
from apps.races.models import Race

TWO = make_fee(gold=20, resources=[("Treasure", 2), ("Wyrdstone", 1)])


class HirelingFeeWriteTests(CatalogueTestCase):
    def create(self, kind: Any = HIRED_SWORDS, **body: Any) -> Any:
        return self.create_as(self.player, kind, "Duellist", **body)

    def patch(self, entry_id: int, body: dict[str, Any]) -> Any:
        return self.patch_as(self.player, HIRED_SWORDS.detail_url(entry_id), {"campaign_id": self.campaign.id, **body})

    def test_a_fee_takes_one_resource_on_top_of_its_gold(self):
        one = {"gold": 30, "dice": 1, "resources": [{"resource": "Wyrdstone", "amount": 1}]}
        for kind in (HIRED_SWORDS, DRAMATIS_PERSONAE):
            with self.subTest(kind=kind.key):
                response = self.create_as(self.player, kind, f"Duellist {kind.key}", hire_fee=one, upkeep_fee=one)
                self.assertEqual(response.status_code, 201, response.data)
                self.assertEqual(response.data["hire_fee"]["resources"][0]["resource"], "Wyrdstone")

        two = {"gold": 30, "resources": [{"resource": "Wyrdstone", "amount": 1}, {"resource": "Treasure", "amount": 1}]}
        for field in ("hire_fee", "upkeep_fee"):
            with self.subTest(field=field):
                response = self.create(**{field: two})
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.data)

    def test_gold_is_the_fees_own_and_never_its_resource(self):
        for name in ("Gold", "gc", "gold crowns"):
            with self.subTest(name=name):
                response = self.create(hire_fee={"gold": 10, "resources": [{"resource": name, "amount": 5}]})
                self.assertEqual(response.status_code, 400)
                self.assertIn("hire_fee", response.data)

    def test_an_upkeep_never_takes_a_heros_place(self):
        response = self.create(upkeep_fee={"kind": "replaces_hero"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("upkeep_fee", response.data)

    def test_one_who_takes_a_heros_place_has_no_upkeep(self):
        response = self.create(hire_fee={"kind": "replaces_hero"}, upkeep_fee={"gold": 15})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["upkeep_fee"]["kind"], "none")

        sword = make_entry(HIRED_SWORDS, "Priest", campaign=self.campaign, upkeep_fee=make_fee(gold=15))
        response = self.patch(sword.id, {"hire_fee": {"kind": "replaces_hero"}})  # the upkeep isn't sent
        self.assertEqual(response.status_code, 200, response.data)
        sword.refresh_from_db()
        self.assertEqual((sword.hire_fee["kind"], sword.upkeep_fee["kind"]), ("replaces_hero", "none"))

        response = self.patch(sword.id, {"upkeep_fee": {"gold": 20}})  # still in a hero's place
        sword.refresh_from_db()
        self.assertEqual((response.status_code, sword.upkeep_fee["kind"]), (200, "none"))

    def test_an_old_fee_with_several_resources_loads_and_stays_while_a_write_leaves_it_out(self):
        own = make_entry(HIRED_SWORDS, "Prospector", campaign=self.campaign, hire_fee=TWO)
        HiredSword.objects.filter(id=self.ogre.id).update(hire_fee=TWO)

        detail = self.get_as(self.player, HIRED_SWORDS.detail_url(own.id)).json()
        self.assertEqual([line["resource"] for line in detail["hire_fee"]["resources"]], ["Treasure", "Wyrdstone"])

        self.assertEqual(self.patch(own.id, {"name": "Old Prospector", "upkeep_fee": {"gold": 5}}).status_code, 200)
        own.refresh_from_db()
        self.assertEqual((own.name, own.hire_fee), ("Old Prospector", TWO))

        version = self.patch(self.ogre.id, {"rating": 30}).json()  # a book entry's first edit: the version keeps it
        self.assertEqual(HiredSword.objects.get(id=version["id"]).hire_fee, TWO)


class HirelingRaceTests(CatalogueTestCase):
    def test_a_race_added_from_the_form_is_the_campaigns_and_names_the_entry(self):
        maximums = {"movement": 5, "weapon_skill": 7, "ballistic_skill": 6, "strength": 4, "toughness": 4}
        maximums |= {"wounds": 3, "initiative": 7, "attacks": 4, "leadership": 9}
        race = self.post_as(
            self.player, RACES.list_url(), {"name": "Tilean", "campaign_id": self.campaign.id, **maximums}
        )
        self.assertEqual(race.status_code, 201, race.data)
        made = Race.objects.get(id=race.data["id"])
        self.assertEqual((made.campaign_id, made.weapon_skill, made.initiative), (self.campaign.id, 7, 7))

        response = self.create_as(self.player, HIRED_SWORDS, "Duellist", race_id=made.id, race_label="Tilean")

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual((response.data["race_id"], response.data["race_name"]), (made.id, "Tilean"))
        self.assertIn("Tilean", self.listed(self.player, RACES))
