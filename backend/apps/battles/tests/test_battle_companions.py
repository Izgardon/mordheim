"""Battle rosters carry each unit's mount and pets (the bestiary rewrite step 4), read live until the battle starts and
kept in the start/ snapshot after: the mount (its item, name, Move, rating bonus and profile), the pets, and the Move
and armour save the mount gives the rider (`effectiveStats`), beside his own `stats`. A henchmen group's members ride
the group's mount, and a group recruited from a creature names its beast and kind.
"""

from typing import Any

from apps.warbands.models import HenchmenGroup, HenchmenGroupItem, Hero, HeroItem
from apps.warbands.tests.beast_support import beast, raven, wardogs, warhorse
from apps.warbands.tests.roster_support import HENCHMEN, make_unit

from .battle_support import BattleTestCase


class BattleRosterCompanionTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.horse, self.raven, self.dogs = warhorse(), raven(), wardogs()
        self.hero = Hero.objects.create(warband=self.warband, name="Aldric", unit_type="Captain", movement=4)
        HeroItem.objects.create(hero=self.hero, item=self.horse, companion=True)
        HeroItem.objects.create(hero=self.hero, item=self.raven, companion=True)

    def roster(self, battle_id: int) -> Any:
        return self.ok(self.get_as(self.viewer, self.url(battle_id, "rosters"))).data[str(self.player.id)]

    def test_a_rider_brings_his_mount_and_pets_into_the_battle_and_keeps_them_in_the_snapshot(self):
        battle_id = self.to_prebattle()

        [hero] = self.roster(battle_id)["heroes"]

        mount = {"itemId": self.horse.id, "name": "Warhorse", "hasProfile": True, "movement": 8, "ratingBonus": 5}
        self.assertEqual({key: hero["mount"][key] for key in mount}, mount)
        self.assertEqual(hero["mount"]["stats"]["movement"], 8)
        self.assertEqual(hero["pets"], [{"itemId": self.raven.id, "name": "Raven", "hasProfile": False, "stats": None}])
        self.assertEqual((hero["effectiveStats"], hero["stats"]["movement"]), ({"movement": 8, "armour_save": 6}, 4))

        for user in (self.player, self.viewer):
            self.ok(self.post_as(user, self.url(battle_id, "ready"), {"ready": True}))
        self.ok(self.post_as(self.player, self.url(battle_id, "start")))
        HeroItem.objects.filter(hero=self.hero).update(companion=False)  # switched off mid-battle on the sheet

        [kept] = self.roster(battle_id)["heroes"]
        self.assertEqual((kept["mount"]["name"], kept["effectiveStats"]["movement"]), ("Warhorse", 8))

    def test_a_groups_members_ride_its_mount_and_a_creature_group_names_its_beast(self):
        riders = make_unit(HENCHMEN, self.warband, name="Outriders", members=("A", "B"), movement=4)
        HenchmenGroupItem.objects.create(henchmen_group=riders, item=self.horse, companion=True)
        kennel = make_unit(HENCHMEN, self.warband, name="Kennel", source_beast=beast(self.dogs))
        battle_id = self.to_prebattle()

        groups = {group["name"]: group for group in self.roster(battle_id)["henchmenGroups"]}

        self.assertEqual([member["effectiveStats"]["movement"] for member in groups["Outriders"]["members"]], [8, 8])
        self.assertEqual(groups["Outriders"]["members"][0]["mount"]["name"], "Warhorse")
        self.assertEqual((groups["Outriders"]["sourceBeastId"], groups["Outriders"]["beastKind"]), (None, None))
        source = HenchmenGroup.objects.get(pk=kennel.pk).source_beast_id
        self.assertEqual((groups["Kennel"]["sourceBeastId"], groups["Kennel"]["beastKind"]), (source, "creature"))
        self.assertEqual(groups["Kennel"]["members"][0]["mount"], None)
