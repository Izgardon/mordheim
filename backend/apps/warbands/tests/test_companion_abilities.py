"""A switched-on mount or pet brings its beast's skills, specials and spells (the bestiary rewrite step 5).

Each companion in a unit payload (`mount`, `pets`) lists its beast's entries from the bestiary's pivots, as the unit's
own detail lists show theirs: shown with the unit, never part of its own lists or of a PATCH. They are read with the
item rows (no query per row), so the sheet and the unit lists cost the same however many riders there are.
"""

from typing import Any

from apps.core.testing import count_get_queries
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell
from apps.warbands.models import HenchmenGroupItem, HeroItem, HirelingItem

from .beast_support import make_animal, raven, teach, warhorse
from .roster_support import HENCHMEN, HERO, HIRELING, RosterTestCase, make_unit, unit_url


class CompanionAbilityTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.horse, self.raven = warhorse(), raven()
        self.charge = Skill.objects.create(name="Thunderous Charge", type="Mount")
        self.kick = Special.objects.create(name="Kick", type="Ability", description="Kicks in close combat.")
        self.hoof = Spell.objects.create(name="Hoof Hex", type="Beast", dc="7", description="A hex.")
        teach(self.horse, skills=(self.charge,), specials=(self.kick,), spells=(self.hoof,))
        self.hero = make_unit(HERO, self.warband, name="Aldric", movement=4)
        self.steed = make_animal("Elven Steed", "mount")  # a group's second kind of mount (its `mounts`)
        teach(self.steed, specials=(self.kick,))

    def hero_payload(self, url: str) -> Any:
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200, response.data)
        heroes = response.data["heroes"] if "heroes" in response.data else response.data
        return next(unit for unit in heroes if unit["id"] == self.hero.id)

    def test_a_ridden_mount_lists_its_beasts_skills_specials_and_spells_apart_from_the_riders_own(self):
        HeroItem.objects.create(hero=self.hero, item=self.horse, companion=True)

        unit = self.hero_payload(f"/api/warbands/{self.warband.id}/sheet/")

        mount = unit["mount"]
        self.assertEqual(mount["skills"], [{"id": self.charge.id, "name": "Thunderous Charge", "type": "Mount"}])
        kick = {"id": self.kick.id, "name": "Kick", "type": "Ability", "description": "Kicks in close combat."}
        self.assertEqual(mount["specials"], [kick])
        hoof = {"id": self.hoof.id, "name": "Hoof Hex", "type": "Beast", "dc": "7", "description": "A hex."}
        self.assertEqual(mount["spells"], [hoof])
        self.assertEqual((unit["skills"], unit["specials"], unit["spells"]), ([], [], []))

    def test_a_pet_lists_its_entries_and_a_beast_without_any_lists_none(self):
        HeroItem.objects.create(hero=self.hero, item=self.raven, companion=True)
        sharp = Special.objects.create(name="Sharp Eyes", type="Ability")
        teach(self.raven, specials=(sharp,))
        HeroItem.objects.create(hero=self.hero, item=make_animal("Mule", "mount"), companion=True)

        unit = self.hero_payload(unit_url(HERO, self.warband.id, suffix="detail/"))

        [pet] = unit["pets"]
        self.assertEqual((pet["skills"], [entry["name"] for entry in pet["specials"]], pet["spells"]), ([], ["Sharp Eyes"], []))  # fmt: skip
        self.assertEqual((unit["mount"]["name"], unit["mount"]["skills"], unit["mount"]["specials"]), ("Mule", [], []))  # fmt: skip

    def test_the_summary_list_and_the_switch_answer_carry_them_too(self):
        row = HeroItem.objects.create(hero=self.hero, item=self.horse)

        switched = self.client.post(unit_url(HERO, self.warband.id, self.hero.id, f"items/{row.id}/companion/"), {"on": True}, format="json")  # fmt: skip
        listed = self.hero_payload(unit_url(HERO, self.warband.id))

        self.assertEqual(switched.data["unit"]["mount"]["skills"][0]["name"], "Thunderous Charge")
        self.assertEqual(listed["mount"]["specials"][0]["name"], "Kick")

    def test_a_purchase_answer_carries_them(self):
        body = {"item_id": self.horse.id, "target_type": "hero", "target_id": self.hero.id, "companion": True}

        response = self.client.post(f"/api/warbands/{self.warband.id}/purchases/", body, format="json")

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["mount"]["spells"][0]["name"], "Hoof Hex")

    def test_a_group_on_mixed_mounts_lists_each_kind_once_in_mounts(self):
        pony, footed = make_animal("Pony", "mount"), Skill.objects.create(name="Sure Footed", type="Mount")
        teach(pony, skills=(footed,))
        group = make_unit(HENCHMEN, self.warband, members=("A", "B", "C"))
        for item in (self.horse, pony, self.horse):
            HenchmenGroupItem.objects.create(henchmen_group=group, item=item, companion=True)
        HenchmenGroupItem.objects.create(henchmen_group=group, item=pony)  # a spare brings nothing

        for url in (f"/api/warbands/{self.warband.id}/sheet/", unit_url(HENCHMEN, self.warband.id)):
            with self.subTest(url=url):
                response = self.client.get(url)
                groups = response.data["henchmen_groups"] if "henchmen_groups" in response.data else response.data
                unit = next(entry for entry in groups if entry["id"] == group.id)
                mounts = [(mount["name"], [skill["name"] for skill in mount["skills"]]) for mount in unit["mounts"]]
                self.assertEqual(mounts, [("Warhorse", ["Thunderous Charge"]), ("Pony", ["Sure Footed"])])
                self.assertEqual(unit["mount"]["name"], "Warhorse")

    def ride(self, count: int) -> None:
        for _ in range(count):
            hero = make_unit(HERO, self.warband)
            HeroItem.objects.create(hero=hero, item=self.horse, companion=True)
            HeroItem.objects.create(hero=hero, item=self.raven, companion=True)
            group = make_unit(HENCHMEN, self.warband, members=("A", "B"))
            HenchmenGroupItem.objects.create(henchmen_group=group, item=self.horse, companion=True)
            HenchmenGroupItem.objects.create(henchmen_group=group, item=self.steed, companion=True)
            sword = make_unit(HIRELING, self.warband)
            HirelingItem.objects.create(hireling=sword, item=self.horse, companion=True)

    def test_the_sheet_and_the_unit_lists_read_them_in_a_fixed_number_of_queries(self):
        urls = [f"/api/warbands/{self.warband.id}/sheet/"]
        for kind in (HERO, HENCHMEN, HIRELING):
            urls += [unit_url(kind, self.warband.id), unit_url(kind, self.warband.id, suffix="detail/")]
        self.ride(1)
        few = {url: count_get_queries(self.client, url) for url in urls}

        self.ride(3)

        self.assertEqual({url: count_get_queries(self.client, url) for url in urls}, few)
