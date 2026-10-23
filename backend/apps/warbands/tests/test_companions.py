"""Companions: a mount or a pet switched on for the unit holding it (the bestiary rewrite step 4).

`POST warbands/<id>/<kind>/<unit id>/items/<item row id>/companion/ {"on": bool}` switches one of the unit's item
rows on or off. Only an Animal item whose beast is a mount or a pet switches on; the answer is the unit, the summary
and warnings (two mounts on one rider, a group's mounts against its living members, more than two mounts in the
warband), never a refusal. A mount changes what the rider shows (`effective_stats`: the mount's Move, the save one
better or 6+), never his stats. Every unit payload's items carry their row id, the switch and the beast's kind, and
the unit its `mount` and `pets`.
"""

from typing import Any

from apps.warbands.models import HenchmenGroupItem, HeroItem, HirelingItem

from .beast_support import make_animal, raven, wardogs, warhorse
from .roster_support import HENCHMEN, HERO, HIRELING, RosterTestCase, make_unit, unit_url


class CompanionTestCase(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.horse, self.raven, self.dogs = warhorse(), raven(), wardogs()
        self.hero = make_unit(HERO, self.warband, name="Aldric", movement=4, armour_save=6)

    def switch(self, row: Any, on: bool = True, kind: Any = HERO, unit: Any = None) -> Any:
        unit = unit or self.hero
        url = unit_url(kind, self.warband.id, unit.id, f"items/{row.id}/companion/")
        return self.client.post(url, {"on": on}, format="json")


class CompanionSwitchTests(CompanionTestCase):
    def test_a_mount_switched_on_is_ridden_and_changes_what_he_shows_not_his_stats(self):
        row = HeroItem.objects.create(hero=self.hero, item=self.horse, cost=80)

        response = self.switch(row)

        self.assertEqual(response.status_code, 200, response.data)
        unit = response.data["unit"]
        profile: dict[str, Any] = {
            "movement": 8,
            "weapon_skill": 3,
            "ballistic_skill": 0,
            "strength": 3,
            "toughness": 3,
            "wounds": 1,
        }
        profile |= {"initiative": 3, "attacks": 1, "leadership": 5, "armour_save": None}
        mount = {"item_row_id": row.id, "item_id": self.horse.id, "name": "Warhorse", "movement": 8, "rating_bonus": 5}
        self.assertEqual(unit["mount"], {**mount, "has_profile": True, "stats": profile})
        self.assertEqual(unit["effective_stats"], {"movement": 8, "armour_save": 5})
        self.assertEqual((unit["movement"], unit["armour_save"], unit["pets"]), (4, 6, []))
        [item] = unit["items"]
        self.assertEqual((item["row_id"], item["companion"], item["beast_kind"]), (row.id, True, "mount"))
        self.assertEqual(response.data["warnings"], [])
        self.assertIn("rating", response.data["summary"])
        self.assertTrue(HeroItem.objects.get(pk=row.pk).companion)
        self.hero.refresh_from_db()
        self.assertEqual((self.hero.movement, self.hero.armour_save), (4, 6))

    def test_switching_off_puts_him_back_on_foot(self):
        row = HeroItem.objects.create(hero=self.hero, item=self.horse, companion=True)

        unit = self.switch(row, on=False).data["unit"]

        self.assertEqual((unit["mount"], unit["effective_stats"], unit["items"][0]["companion"]), (None, None, False))

    def test_a_pet_goes_with_its_unit_and_one_without_a_profile_shows_none(self):
        row = HeroItem.objects.create(hero=self.hero, item=self.raven)

        unit = self.switch(row).data["unit"]

        pet = {"item_row_id": row.id, "item_id": self.raven.id, "name": "Raven", "has_profile": False, "stats": None}
        self.assertEqual((unit["pets"], unit["mount"], unit["effective_stats"]), ([pet], None, None))

    def test_a_mount_without_a_profile_keeps_his_move_and_still_betters_his_save(self):
        boar = make_animal("Wild Boar", "mount", has_profile=False)
        HeroItem.objects.create(hero=self.hero, item=self.horse)  # not switched on
        row = HeroItem.objects.create(hero=self.hero, item=boar)
        self.hero.armour_save = None
        self.hero.save()

        unit = self.switch(row).data["unit"]

        self.assertEqual((unit["mount"]["movement"], unit["mount"]["stats"], unit["mount"]["rating_bonus"]), (None, None, 0))  # fmt: skip
        self.assertEqual(unit["effective_stats"], {"movement": 4, "armour_save": 6})  # no save: 6+

    def test_only_a_mount_or_a_pet_switches_on(self):
        for item in (self.sword, self.dogs):
            row = HeroItem.objects.create(hero=self.hero, item=item)
            response = self.switch(row)
            self.assertEqual((response.status_code, response.data["code"]), (400, "not_a_companion"), item.name)
            self.assertFalse(HeroItem.objects.get(pk=row.pk).companion)
        self.assertEqual(self.switch(row, on=False).status_code, 200)  # switching off always works

    def test_the_body_says_on_or_off(self):
        row = HeroItem.objects.create(hero=self.hero, item=self.horse)

        response = self.client.post(unit_url(HERO, self.warband.id, self.hero.id, f"items/{row.id}/companion/"), {}, format="json")  # fmt: skip

        self.assertEqual((response.status_code, response.data["code"], list(response.data["fields"])), (400, "invalid", ["on"]))  # fmt: skip

    def test_only_the_unit_holding_the_item_switches_it(self):
        other = make_unit(HERO, self.warband, name="Brother")
        row = HeroItem.objects.create(hero=other, item=self.horse)

        response = self.switch(row)

        self.assertEqual((response.status_code, response.data["code"]), (404, "not_found"))
        self.assertFalse(HeroItem.objects.get(pk=row.pk).companion)

    def test_a_dead_or_another_warbands_unit_is_not_found(self):
        dead = make_unit(HERO, self.warband, dead=True)
        rival = make_unit(HERO, self.rival)
        for unit in (dead, rival):
            row = HeroItem.objects.create(hero=unit, item=self.horse)
            self.assertEqual(self.switch(row, unit=unit).status_code, 404)

    def test_who_may_switch(self):
        row = HeroItem.objects.create(hero=self.hero, item=self.horse)
        for user, status in ((self.viewer, 403), (self.outsider, 404), (self.manager, 200)):
            self.client.force_authenticate(user=user)
            self.assertEqual(self.switch(row).status_code, status, user.email)

    def test_the_switch_moves_the_units_version(self):
        row = HeroItem.objects.create(hero=self.hero, item=self.horse)
        before = self.hero.updated_at

        self.switch(row)

        self.hero.refresh_from_db()
        self.assertGreater(self.hero.updated_at, before)

    def test_every_kind_switches_its_own_rows(self):
        group = make_unit(HENCHMEN, self.warband, members=("A",))
        sword = make_unit(HIRELING, self.warband)
        rows = (
            (HENCHMEN, group, HenchmenGroupItem.objects.create(henchmen_group=group, item=self.horse)),
            (HIRELING, sword, HirelingItem.objects.create(hireling=sword, item=self.raven)),
        )
        for kind, unit, row in rows:
            response = self.switch(row, kind=kind, unit=unit)
            self.assertEqual(response.status_code, 200, response.data)
            self.assertTrue(type(row).objects.get(pk=row.pk).companion)


class CompanionWarningTests(CompanionTestCase):
    def codes(self, response: Any) -> list[str]:
        self.assertEqual(response.status_code, 200, response.data)
        return [warning["code"] for warning in response.data["warnings"]]

    def test_two_mounts_on_one_rider_warn(self):
        HeroItem.objects.create(hero=self.hero, item=self.horse, companion=True)
        row = HeroItem.objects.create(hero=self.hero, item=self.horse)

        response = self.switch(row)

        self.assertEqual(self.codes(response), ["two_mounts"])
        self.assertEqual(response.data["unit"]["mount"]["item_row_id"], self.hero.hero_items.order_by("id")[0].id)

    def test_a_group_rides_one_mount_per_living_member(self):
        group = make_unit(HENCHMEN, self.warband, members=("A", "B"))
        rows = [HenchmenGroupItem.objects.create(henchmen_group=group, item=self.horse) for _ in range(2)]

        first = self.switch(rows[0], kind=HENCHMEN, unit=group)
        second = self.switch(rows[1], kind=HENCHMEN, unit=group)

        self.assertEqual(first.data["warnings"][0]["code"], "group_mounts")
        self.assertEqual((first.data["warnings"][0]["mounts"], first.data["warnings"][0]["members"]), (1, 2))
        self.assertEqual(self.codes(second), [])

    def test_more_than_two_mounts_in_the_warband_warn(self):
        for name in ("Brother", "Cousin"):
            HeroItem.objects.create(hero=make_unit(HERO, self.warband, name=name), item=self.horse, companion=True)
        HeroItem.objects.create(hero=make_unit(HERO, self.warband, dead=True), item=self.horse, companion=True)
        row = HeroItem.objects.create(hero=self.hero, item=self.horse)

        response = self.switch(row)

        self.assertEqual(self.codes(response), ["warband_mounts"])
        self.assertEqual(response.data["warnings"][0]["mounts"], 3)  # the dead hero's mount isn't counted
        self.assertEqual(self.codes(self.switch(row, on=False)), [])
