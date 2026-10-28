"""Battle rosters carry each unit's mount and pets (the bestiary rewrite step 4), read live until the battle starts and
kept in the start/ snapshot after: the mount (its item, name, Move, rating bonus and profile), the pets, and the Move
and armour save the mount gives the rider (`effectiveStats`), beside his own `stats`. A henchmen group's members ride
one each of the group's mounts, in order, and a group recruited from a creature names its beast and kind.
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.battles.services.items_lost import henchman_takes_his_share
from apps.skills.models import Skill
from apps.spells.models import Spell
from apps.warbands.models import HenchmenGroup, HenchmenGroupItem, Hero, HeroItem
from apps.warbands.tests.beast_support import beast, raven, teach, wardogs, warhorse
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

        outriders = groups["Outriders"]["members"]  # one horse for two: the second goes on foot
        self.assertEqual([(member["mount"] or {}).get("name") for member in outriders], ["Warhorse", None])
        self.assertEqual([(member["effectiveStats"] or {}).get("movement") for member in outriders], [8, None])
        message = "Every member of a group carries the same gear, so Outriders can't take the field until each of its 2 members has a Warhorse (it has 1)."  # fmt: skip
        warning = {"code": "group_mounts", "message": message, "mounts": 1, "members": 2}
        self.assertEqual((groups["Outriders"]["mountWarnings"], groups["Kennel"]["mountWarnings"]), ([warning], []))
        self.assertEqual((groups["Outriders"]["sourceBeastId"], groups["Outriders"]["beastKind"]), (None, None))
        source = HenchmenGroup.objects.get(pk=kennel.pk).source_beast_id
        self.assertEqual((groups["Kennel"]["sourceBeastId"], groups["Kennel"]["beastKind"]), (source, "creature"))
        self.assertEqual(groups["Kennel"]["members"][0]["mount"], None)

    def ride(self, count: int) -> None:
        for _ in range(count):
            hero = Hero.objects.create(warband=self.warband, name="Rider", unit_type="Knight")
            HeroItem.objects.create(hero=hero, item=self.horse, companion=True)
            group = make_unit(HENCHMEN, self.warband, members=("A",), source_beast=beast(self.dogs))
            HenchmenGroupItem.objects.create(henchmen_group=group, item=self.horse, companion=True)

    def test_a_mounts_and_a_pets_beast_entries_come_into_the_battle_in_the_rosters_shapes(self):
        charge = Skill.objects.create(name="Thunderous Charge", type="Mount")
        hoof = Spell.objects.create(name="Hoof Hex", type="Beast", dc="7", description="Left out of the roster.")
        teach(self.horse, skills=(charge,), spells=(hoof,))
        battle_id = self.to_prebattle()

        [hero] = self.roster(battle_id)["heroes"]

        self.assertEqual(hero["mount"]["skills"], [{"id": charge.id, "name": "Thunderous Charge"}])
        self.assertEqual(hero["mount"]["spells"], [{"id": hoof.id, "name": "Hoof Hex", "dc": "7"}])
        self.assertNotIn("specials", hero["mount"])  # empty lists are left out
        self.assertEqual((hero["skills"], hero["spells"]), ([], []))
        self.assertNotIn("skills", hero["pets"][0])

    def test_rosters_read_beasts_in_a_fixed_number_of_queries(self):
        teach(self.horse, skills=(Skill.objects.create(name="Thunderous Charge", type="Mount"),))
        self.ride(1)
        battle_id = self.to_prebattle()
        self.roster(battle_id)  # the first read in a minute writes presence
        with CaptureQueriesContext(connection) as few:
            self.roster(battle_id)
        self.ride(3)

        with CaptureQueriesContext(connection) as many:
            self.roster(battle_id)

        self.assertEqual(len(many), len(few))


class HenchmanLossTests(BattleTestCase):
    def test_a_henchman_who_dies_takes_a_ridden_copy_first(self):
        horse = warhorse()
        group = make_unit(HENCHMEN, self.warband, members=("A", "B"))
        spare = HenchmenGroupItem.objects.create(henchmen_group=group, item=horse)
        for _ in range(2):
            HenchmenGroupItem.objects.create(henchmen_group=group, item=horse, companion=True)

        henchman_takes_his_share(group)

        rows = HenchmenGroupItem.objects.filter(henchmen_group=group).order_by("id")
        self.assertEqual([(row.id == spare.id, row.companion) for row in rows], [(True, False), (False, True)])
