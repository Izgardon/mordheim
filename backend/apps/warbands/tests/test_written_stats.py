"""Stats written as the books print them (William, 3 Nov 2026): a stat is sent as a number or as text ("1(2)", "5*",
"2D6", "-"). The stat holds the number a written value starts with, or none ("D6", "-": not 0), and `written_stats`
what follows it ("(2)") or the whole text; a plain number clears it. The number and the text move together (William:
"the text part was just the (2) here"): an advance turns "1(2)" into "2(2)", an injury lowers only a number, and
hires, promotions and battle rosters carry the text."""

from typing import Any

from apps.battles.services.injuries import InjuryOutcome, apply_stat_and_special
from apps.battles.services.postbattle.stats import kept_stats
from apps.battles.services.rosters import hero_entry
from apps.hirelings.models import HiredSword
from apps.warbands.models import Hero
from apps.warbands.utils.stats import STAT_ERROR, WRITTEN_TOO_LONG, Stat, read_stat, shown_stat, stat_inputs

from .roster_support import HENCHMEN, HERO, HIRELING, KINDS, RosterTestCase, make_unit, unit_url


class ReadStatTests(RosterTestCase):
    def test_a_number_is_a_plain_stat(self):
        for value in (4, "4", " 4 ", 4.0, 0, "10"):
            with self.subTest(value=value):
                self.assertEqual(read_stat(value).written, None)
        self.assertEqual(read_stat("10"), Stat(10, None))

    def test_a_written_value_is_its_number_and_what_follows_it(self):
        cases = {"1(2)": (1, "(2)"), "5*": (5, "*"), "3(6)": (3, "(6)"), "1+1": (1, "+1"), "  1 (2) ": (1, " (2)")}
        for text, stat in cases.items():
            with self.subTest(text=text):
                self.assertEqual(read_stat(text), Stat(*stat))

    def test_a_roll_or_a_dash_is_its_whole_text_with_no_number(self):
        for text in ("2D6", "D6", "d3", "-"):
            with self.subTest(text=text):
                self.assertEqual(read_stat(text), Stat(None, text))

    def test_anything_else_is_refused(self):
        for value in ("", "  ", "11", "12*", -1, True, None, ["4"]):
            with self.subTest(value=value), self.assertRaisesMessage(ValueError, STAT_ERROR):
                read_stat(value)
        with self.assertRaisesMessage(ValueError, WRITTEN_TOO_LONG):
            read_stat("1(2) or 3(4)")

    def test_a_stat_shows_its_number_and_then_its_text(self):
        self.assertEqual([shown_stat(2, "(2)"), shown_stat(None, "D6"), shown_stat(4, None)], ["2(2)", "D6", "4"])

    def test_a_profile_is_sent_on_as_written(self):
        hero = make_unit(HERO, self.warband, attacks=2, weapon_skill=None, written_stats={"attacks": "(2)", "weapon_skill": "D6"})  # fmt: skip
        inputs = stat_inputs(hero)
        self.assertEqual((inputs["attacks"], inputs["weapon_skill"], inputs["strength"]), ("2(2)", "D6", hero.strength))


class WrittenStatWriteTests(RosterTestCase):
    def patch(self, kind: Any, unit: Any, body: dict[str, Any]) -> Any:
        return self.client.patch(unit_url(kind, self.warband.id, unit.id), body, format="json")

    def test_each_kind_takes_a_written_stat_and_a_number_clears_it(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, attacks=1, weapon_skill=3)

                written = self.patch(kind, unit, {"attacks": "1(2)", "weapon_skill": "D6"})
                cleared = self.patch(kind, unit, {"attacks": 2})

                self.assertEqual(written.status_code, 200, written.data)
                body = written.json()
                self.assertEqual((body["attacks"], body["weapon_skill"]), (1, None))
                self.assertEqual(body["written_stats"], {"attacks": "(2)", "weapon_skill": "D6"})
                self.assertEqual((cleared.json()["attacks"], cleared.json()["written_stats"]), (2, {"weapon_skill": "D6"}))  # fmt: skip
                unit.refresh_from_db()
                self.assertEqual((unit.attacks, unit.weapon_skill), (2, None))

    def test_a_dash_is_not_0(self):
        unit = make_unit(HERO, self.warband)

        body = self.patch(HERO, unit, {"weapon_skill": "-"}).json()

        self.assertEqual((body["weapon_skill"], body["written_stats"]), (None, {"weapon_skill": "-"}))

    def test_a_bad_stat_is_a_400_naming_it(self):
        unit = make_unit(HERO, self.warband, attacks=1)

        response = self.patch(HERO, unit, {"attacks": "11", "strength": "a very long value"})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["attacks"], [STAT_ERROR])
        self.assertEqual(response.json()["strength"], [WRITTEN_TOO_LONG])
        unit.refresh_from_db()
        self.assertEqual((unit.attacks, unit.written_stats), (1, {}))


class WrittenStatSumsTests(RosterTestCase):
    def level_up(self, kind: Any, unit: Any, code: str) -> Any:
        body = {"payload": {"advance": {"id": code}}}
        return self.client.post(unit_url(kind, self.warband.id, unit.id, "level-up/"), body, format="json")

    def test_an_advance_raises_a_written_stat_s_number_and_its_text_follows(self):
        unit = make_unit(HERO, self.warband, level_up=1, attacks=1, written_stats={"attacks": "(2)"})

        response = self.level_up(HERO, unit, "A")

        self.assertEqual(response.status_code, 200, response.data)
        body = response.json()
        self.assertEqual(shown_stat(body["attacks"], body["written_stats"]["attacks"]), "2(2)")

    def test_an_advance_leaves_a_stat_without_a_number_without_one_and_still_spends_the_level_up(self):
        unit = make_unit(HENCHMEN, self.warband, level_up=1, weapon_skill=None, written_stats={"weapon_skill": "D6"})

        response = self.level_up(HENCHMEN, unit, "WS")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual((response.json()["weapon_skill"], response.json()["level_up"]), (None, 0))

    def test_an_injury_lowers_a_number_only(self):
        hero = make_unit(HERO, self.warband, strength=None, toughness=3, written_stats={"strength": "D6"})

        lowered = apply_stat_and_special(hero, InjuryOutcome(stat="toughness"), self.campaign.id)
        untouched = apply_stat_and_special(hero, InjuryOutcome(stat="strength"), self.campaign.id)

        self.assertEqual((lowered, untouched), (["toughness"], []))
        self.assertEqual((hero.toughness, hero.strength), (2, None))

    def test_a_number_kept_from_the_battle_replaces_a_roll_and_keeps_what_follows_a_number(self):
        hero = make_unit(HERO, self.warband, strength=None, attacks=1, written_stats={"strength": "D6", "attacks": "(2)"})  # fmt: skip
        logs: list[dict[str, Any]] = []

        fields = kept_stats(hero, {"strength": 4, "attacks": 3}, "Kurt", logs)

        self.assertEqual(fields, ["strength", "written_stats", "attacks"])
        self.assertEqual((hero.strength, hero.attacks, hero.written_stats), (4, 3, {"attacks": "(2)"}))
        changes = {"strength": {"before": None, "after": 4}, "attacks": {"before": 1, "after": 3}}
        self.assertEqual(logs, [{"unit_name": "Kurt", "changes": changes}])


class WrittenStatCopyTests(RosterTestCase):
    def test_a_hire_copies_the_written_values(self):
        stats = {"movement": 6, "weapon_skill": None, "attacks": 2, "written_stats": {"weapon_skill": "D6", "attacks": "(3)"}}  # fmt: skip
        ogre = HiredSword.objects.create(name="Ogre", race=self.race, **stats)
        url = unit_url(HIRELING, self.warband.id, suffix="hire/")

        response = self.client.post(url, {"source": "hired_sword", "id": ogre.id}, format="json")

        self.assertEqual(response.status_code, 201, response.data)
        body = response.data
        self.assertEqual((body["weapon_skill"], body["attacks"], body["movement"]), (None, 2, 6))
        self.assertEqual(body["written_stats"], {"weapon_skill": "D6", "attacks": "(3)"})

    def test_a_promotion_copies_the_group_s_written_values(self):
        group = make_unit(HENCHMEN, self.warband, level_up=1, xp=5, attacks=1, written_stats={"attacks": "(2)"})
        alpha = group.henchmen.order_by("id").first()
        body = {"henchman_id": alpha.id, "advance": {"id": "WS", "label": "Weapon Skill"}}

        response = self.client.post(unit_url(HENCHMEN, self.warband.id, group.id, "promote/"), body, format="json")

        self.assertEqual(response.status_code, 201, response.data)
        hero = Hero.objects.get(id=response.json()["hero"]["id"])
        self.assertEqual((hero.attacks, hero.written_stats), (1, {"attacks": "(2)"}))

    def test_a_battle_roster_carries_the_written_values(self):
        hero = make_unit(HERO, self.warband, weapon_skill=None, written_stats={"weapon_skill": "D6"})

        entry = hero_entry(hero)

        self.assertEqual((entry["stats"]["weapon_skill"], entry["writtenStats"]), (None, {"weapon_skill": "D6"}))
