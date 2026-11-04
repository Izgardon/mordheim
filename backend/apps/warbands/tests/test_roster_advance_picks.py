"""Picks an advance gives, made inside the advance or later from the card (services/advance_picks.py).

A Skill, Spell or Special advance may name its pick in the level-up POST (`pick`): the level-up is spent, the entry
joins the list and no pick is left for later. A spell is picked by id or rolled: a lore and the D6 roll on its
table. A spell he knows already gets 1 easier for him (his link's `dc_change`), and stays so when Edit resends his
spells. `pick/` makes a pick left for later the same way.
"""

from typing import Any

from apps.skills.models import Skill
from apps.spells.models import Spell
from apps.warbands.models import WarbandLog

from .roster_support import HENCHMEN, HERO, HIRELING, Kind, RosterTestCase, make_unit, unit_url


class AdvancePickTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.lore = [Spell.objects.create(name=f"Necro {roll}", type="Necromancy", dc=str(4 + roll), roll=roll) for roll in range(1, 6)]  # fmt: skip
        self.auto = Spell.objects.create(name="Spell of Awakening", type="Necromancy", dc="Auto", roll=6)

    def _advance(self, kind: Kind, unit: Any, advance: str, pick: dict[str, Any] | None, status: int = 200) -> Any:
        body: dict[str, Any] = {"payload": {"hero": unit.name, "advance": {"id": advance}}}
        if pick is not None:
            body["pick"] = pick
        response = self.client.post(unit_url(kind, self.warband.id, unit.id, "level-up/"), body, format="json")
        self.assertEqual(response.status_code, status, response.data)
        return response.json()

    def _pick(self, kind: Kind, unit: Any, pick: dict[str, Any], status: int = 200) -> Any:
        response = self.client.post(unit_url(kind, self.warband.id, unit.id, "pick/"), pick, format="json")
        self.assertEqual(response.status_code, status, response.data)
        return response.json()

    def _logged_pick(self) -> dict[str, Any]:
        log = WarbandLog.objects.filter(warband=self.warband, feature="advance").latest("id")
        return dict(log.payload["pick"])

    def test_a_skill_picked_in_the_advance_joins_his_skills_and_leaves_none_to_choose(self):
        for kind in (HERO, HIRELING):
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, level_up=1)
                answer = self._advance(kind, unit, "Skill", {"list": "skills", "id": self.skills[0].id})
                self.assertEqual([skill["name"] for skill in answer["skills"]], ["Skill 0"])
                self.assertEqual((answer["level_up"], answer["pending_skills"]), (0, 0))
                self.assertEqual(self._logged_pick(), {"list": "skills", "entry_id": self.skills[0].id, "name": "Skill 0", "added": True})  # fmt: skip

    def test_a_skill_outside_his_lists_can_still_be_picked(self):
        hero = make_unit(HERO, self.warband, level_up=1, available_skills=["Shooting"])
        outside = Skill.objects.create(name="Lightning Reflexes")
        answer = self._advance(HERO, hero, "Skill", {"list": "skills", "id": outside.id})
        self.assertEqual([skill["name"] for skill in answer["skills"]], ["Lightning Reflexes"])

    def test_a_rolled_spell_is_the_one_on_that_roll_of_the_lore(self):
        hero = make_unit(HERO, self.warband, level_up=1, caster="Wizard")
        answer = self._advance(HERO, hero, "Spell", {"list": "spells", "lore": "necromancy", "roll": 3})
        self.assertEqual([(spell["name"], spell["dc_change"]) for spell in answer["spells"]], [("Necro 3", 0)])
        self.assertEqual(answer["pending_spells"], 0)
        self.assertEqual(self._logged_pick()["roll"], 3)

    def test_a_spell_he_knows_gets_one_easier_each_time(self):
        hero = make_unit(HERO, self.warband, level_up=2, caster="Wizard")
        hero.hero_spells.create(spell=self.lore[2])  # Necro 3, difficulty 7
        answer = self._advance(HERO, hero, "Spell", {"list": "spells", "lore": "Necromancy", "roll": 3})
        self.assertEqual([(spell["name"], spell["dc"], spell["dc_change"]) for spell in answer["spells"]], [("Necro 3", "7", -1)])  # fmt: skip
        logged = self._logged_pick()
        self.assertEqual((logged["added"], logged["dc_from"], logged["dc_to"]), (False, "7", "6"))
        answer = self._advance(HERO, hero, "Spell", {"list": "spells", "id": self.lore[2].id})
        self.assertEqual(answer["spells"][0]["dc_change"], -2)

    def test_a_spell_cast_automatically_stays_as_it_is(self):
        hero = make_unit(HERO, self.warband, level_up=1, caster="Wizard")
        hero.hero_spells.create(spell=self.auto)
        answer = self._advance(HERO, hero, "Spell", {"list": "spells", "lore": "Necromancy", "roll": 6})
        self.assertEqual((answer["spells"][0]["dc_change"], answer["level_up"]), (0, 0))

    def test_edit_resending_his_spells_keeps_the_easier_difficulty(self):
        hero = make_unit(HERO, self.warband, caster="Wizard")
        hero.hero_spells.create(spell=self.lore[0], dc_change=-1)
        url = unit_url(HERO, self.warband.id, hero.id)
        answer = self.client.patch(url, {"spell_ids": [self.lore[0].id, self.lore[1].id]}, format="json").json()
        self.assertEqual([spell["dc_change"] for spell in answer["spells"]], [-1, 0])
        listed = self.client.get(unit_url(HERO, self.warband.id)).json()[0]["spells"]
        self.assertEqual([spell["dc_change"] for spell in listed], [-1, 0])

    def test_a_refused_pick_spends_nothing(self):
        hero = make_unit(HERO, self.warband, level_up=1)
        self._advance(HERO, hero, "WS", {"list": "skills", "id": self.skills[0].id}, status=400)
        self._advance(HERO, hero, "Skill", {"list": "spells", "id": self.lore[0].id}, status=400)
        self._advance(HERO, hero, "Spell", {"list": "spells", "lore": "Lore of Light", "roll": 2}, status=400)
        self._advance(HERO, hero, "Spell", {"list": "spells", "lore": "Necromancy"}, status=400)
        hero.refresh_from_db()
        self.assertEqual((hero.level_up, hero.weapon_skill, hero.hero_spells.count()), (1, hero.weapon_skill, 0))

    def test_without_a_pick_the_advance_leaves_one_to_choose(self):
        hero = make_unit(HERO, self.warband, level_up=1)
        answer = self._advance(HERO, hero, "Spell", None)
        self.assertEqual((answer["pending_spells"], answer["spells"]), (1, []))

    def test_a_pick_left_for_later_is_made_from_the_card(self):
        sword = make_unit(HIRELING, self.warband, pending_spells=1, pending_skills=2, caster="Priest")
        answer = self._pick(HIRELING, sword, {"list": "spells", "lore": "Necromancy", "roll": 1})
        self.assertEqual(([spell["name"] for spell in answer["spells"]], answer["pending_spells"]), (["Necro 1"], 0))
        answer = self._pick(HIRELING, sword, {"list": "skills", "id": self.skills[1].id})
        self.assertEqual(answer["pending_skills"], 1)
        answer = self._pick(HIRELING, sword, {"list": "spells", "id": self.lore[0].id})
        self.assertEqual((answer["spells"][0]["dc_change"], answer["pending_spells"]), (-1, 0))  # none left: still 0

    def test_henchmen_take_no_picks(self):
        group = make_unit(HENCHMEN, self.warband)
        self._pick(HENCHMEN, group, {"list": "skills", "id": self.skills[0].id}, status=400)

    def test_another_campaigns_entry_is_refused(self):
        foreign = Skill.objects.create(name="Elsewhere", campaign=self.foreign_race.campaign)
        hero = make_unit(HERO, self.warband, pending_skills=1)
        self._pick(HERO, hero, {"list": "skills", "id": foreign.id}, status=400)
