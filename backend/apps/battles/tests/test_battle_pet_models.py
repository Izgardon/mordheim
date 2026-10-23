"""A pet with a profile takes part in a battle as its own model, next to its owner (the bestiary rewrite step 5).

Its battle roster entry carries a unit key, `pet:<owner kind>:<item row id>` (a hero's or hired sword's pet in its
`pets`, a henchmen group's in the group's own `pets`); a pet without a profile has none and stays a chip. Selected in
prebattle, it can be taken out of action, record kills and be killed. Postbattle gives it no XP and no injury roll: it
follows its owner (Mutiny in Marienburg), so it needs no result and finalise ignores one sent for it.
"""

from typing import Any

from apps.warbands.models import HenchmenGroupItem, Hero, HeroItem
from apps.warbands.tests.beast_support import DOG_PROFILE, make_animal, raven
from apps.warbands.tests.roster_support import HENCHMEN, make_unit

from .battle_support import BattleTestCase, draft, unit_result


class PetModelTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.hawk, self.raven = make_animal("Hawk", "pet", **DOG_PROFILE), raven()
        self.aldric = Hero.objects.create(warband=self.warband, name="Aldric", unit_type="Captain")
        self.hawk_row = HeroItem.objects.create(hero=self.aldric, item=self.hawk, companion=True)
        HeroItem.objects.create(hero=self.aldric, item=self.raven, companion=True)
        self.kennel = make_unit(HENCHMEN, self.warband, name="Handlers", members=("A",))
        self.group_hawk = HenchmenGroupItem.objects.create(henchmen_group=self.kennel, item=self.hawk, companion=True)
        self.rat = Hero.objects.create(warband=self.rival, name="Rat", unit_type="Assassin")
        self.a, self.r = f"hero:{self.aldric.id}", f"hero:{self.rat.id}"
        self.pet = f"pet:hero:{self.hawk_row.id}"

    def roster(self, battle_id: int) -> Any:
        return self.ok(self.get_as(self.viewer, self.url(battle_id, "rosters"))).data[str(self.player.id)]

    def test_a_pet_with_a_profile_has_a_unit_key_next_to_its_owner_and_one_without_stays_a_chip(self):
        battle_id = self.to_prebattle()

        roster = self.roster(battle_id)

        [hero] = roster["heroes"]
        hawk, raven_entry = hero["pets"]
        self.assertEqual((hawk["key"], hawk["name"], hawk["stats"]["movement"]), (self.pet, "Hawk", 6))
        self.assertNotIn("key", raven_entry)
        [group] = roster["henchmenGroups"]
        self.assertEqual([pet["key"] for pet in group["pets"]], [f"pet:henchmen_group:{self.group_hawk.id}"])
        self.assertNotIn("key", group["members"][0]["pets"][0])  # the group's pet is one model, not one each

    def test_selected_it_fights_kills_is_killed_and_goes_out_of_action(self):
        battle_id = self.to_active({self.player: [self.a, self.pet], self.viewer: [self.r]})

        out = self.post_as(self.player, self.url(battle_id, "unit-ooa"), {"unit_key": self.pet, "out_of_action": True})
        self.ok(self.post_as(self.player, self.url(battle_id, "unit-ooa"), {"unit_key": self.pet, "out_of_action": False}), 201)  # fmt: skip
        killed = self.ok(self.kill(self.player, battle_id, self.pet, self.r), 201).data["events"][0]["payload_json"]
        victim = self.ok(self.kill(self.viewer, battle_id, self.r, self.pet), 201).data["events"][0]["payload_json"]

        self.ok(out, 201)
        killer = killed["killer"]
        self.assertEqual((killer["unit_key"], killer["unit_type"], killer["name"], killer["type_name"]), (self.pet, "pet", "Hawk", "Pet"))  # fmt: skip
        self.assertEqual((victim["victim"]["name"], victim["victim"]["warband_id"]), ("Hawk", self.warband.id))
        info = self.participant(battle_id, self.player).unit_information_json
        self.assertEqual(info[self.pet]["kill_count"], 1)

    def test_postbattle_gives_it_no_result_and_finalise_ignores_one(self):
        battle_id = self.to_postbattle({self.player: [self.a, self.pet], self.viewer: [self.r]})
        state = self.ok(self.get_as(self.player, self.url(battle_id, "state") + "?view=postbattle")).data
        self.assertEqual(list(state["suggested_postbattle"]["unit_results"]), [self.a])

        sent = draft({self.a: unit_result(self.a, xp=1), self.pet: unit_result(self.pet, xp=5, dead=True)})
        saved = self.ok(self.post_as(self.player, self.url(battle_id, "postbattle"), {"postbattle_json": sent}))
        self.ok(self.finalize(self.player, battle_id, draft({self.a: unit_result(self.a, xp=1)})))  # none for it

        mine = next(entry for entry in saved.data["participants"] if entry["user"]["id"] == self.player.id)
        self.assertEqual(list(mine["postbattle_json"]["unit_results"]), [self.a])
        self.aldric.refresh_from_db()
        self.assertEqual(float(self.aldric.xp), 1)
        self.assertTrue(HeroItem.objects.filter(pk=self.hawk_row.pk).exists())  # it follows its owner

    def test_a_pet_key_names_its_owners_kind_and_a_row(self):
        battle_id = self.to_active({self.player: [self.a, self.pet], self.viewer: [self.r]})

        for key in ("pet:dragon:1", "pet:hero:x", "pet:hero", "pet:hero:0"):
            response = self.post_as(self.player, self.url(battle_id, "unit-ooa"), {"unit_key": key, "out_of_action": True})  # fmt: skip
            self.assertEqual(response.status_code, 400, key)
