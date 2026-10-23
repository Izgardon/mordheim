"""Characterisation: the wire shape of every roster unit response, per kind (pass 1).

Each response is normalised to its keys and JSON value types (ids, names and timestamps
dropped), so the shared serializers in PR B must reproduce today's payloads key for key,
including today's inconsistencies (no `dead` in the hero summary, no `kills` in the
hired-sword summary, no `race`/`deeds` in any summary).
"""

from decimal import Decimal
from typing import Any

from apps.warbands.models import Henchman

from .roster_support import HENCHMEN, HERO, HIRELING, KINDS, Kind, RosterTestCase, make_unit, unit_url


def shape(value: Any) -> Any:
    """Keys and JSON types of a decoded response: lists keep the shape of their first entry."""
    if isinstance(value, dict):
        return {key: shape(item) for key, item in value.items()}
    if isinstance(value, list):
        return [shape(value[0])] if value else []
    if value is None:
        return None
    return type(value).__name__


STATS = dict.fromkeys(
    (
        "movement",
        "weapon_skill",
        "ballistic_skill",
        "strength",
        "toughness",
        "wounds",
        "initiative",
        "attacks",
        "leadership",
        "armour_save",
    ),
    "int",
)
RACE = {"name": "str", **{field: "int" for field in STATS if field != "armour_save"}}
IDENTITY = {
    "id": "int",
    "warband_id": "int",
    "name": "str",
    "unit_type": "str",
    "race_id": "int",
    "race_name": "str",
    "price": "int",
    "xp": "float",
    "level_up": "int",
}
ITEM_SUMMARY = {"id": "int", "name": "str", "type": "str", "cost": "int"}
ITEM_DETAIL = {
    "id": "int",
    "campaign_id": None,
    "name": "str",
    "type": "str",
    "subtype": "str",
    "single_use": "bool",
    "strength": "str",
    "range": "str",
    "save": "str",
    "statblock": None,
    "properties": [{"id": "int", "name": "str"}],
    "availabilities": [
        {
            "id": "int",
            "cost": "int",
            "rarity": "int",
            "restrictions": [
                {"restriction": {"id": "int", "type": "str", "restriction": "str"}, "additional_note": "str"}
            ],
            "variable_cost": None,
        }
    ],
    "cost": "int",
    "current_price": "int",  # decision 11: what Buy again charges
    "suggested_sale_price": "int",  # decision 3
    "sale_price_basis": "str",
}
NAMED = {"id": "int", "name": "str"}
SKILL_DETAIL = {"id": "int", "name": "str", "type": "str"}
SPECIAL_DETAIL = {"id": "int", "name": "str", "type": "str", "description": "str"}
SPELL_DETAIL = {"id": "int", "name": "str", "type": "str", "dc": "str", "description": "str"}
MEMBER = {"id": "int", "name": "str", "kills": "int", "dead": "bool"}

HERO_SUMMARY = {
    **IDENTITY,
    "is_leader": "bool",
    "large": "bool",
    "caster": "str",
    "half_rate": "bool",
    "trading_action": "bool",
    "available_skills": {},
    **STATS,
    "items": [ITEM_SUMMARY],
    "skills": [NAMED],
    "specials": [NAMED],
    "spells": [NAMED],
}
HERO_DETAIL = {
    **HERO_SUMMARY,
    "updated_at": "str",  # pass 2: the version a roster Save sends back
    "race": RACE,
    "kills": "int",
    "deeds": "str",
    "dead": "bool",
    "items": [ITEM_DETAIL],
    "skills": [SKILL_DETAIL],
    "specials": [SPECIAL_DETAIL],
    "spells": [SPELL_DETAIL],
}
HENCHMEN_SUMMARY = {
    **IDENTITY,
    "hire_cost": "int",  # decision 7: what one more member costs
    "max_size": "int",
    "large": "bool",
    "half_rate": "bool",
    "no_level_ups": "bool",
    "dead": "bool",
    **STATS,
    "items": [ITEM_SUMMARY],
    "skills": [NAMED],
    "specials": [NAMED],
    "henchmen": [MEMBER],
}
HENCHMEN_DETAIL = {
    **HENCHMEN_SUMMARY,
    "updated_at": "str",
    "race": RACE,
    "deeds": "str",
    "items": [ITEM_DETAIL],
    "skills": [SKILL_DETAIL],
    "specials": [SPECIAL_DETAIL],
}
HIRELING_SUMMARY = {
    **IDENTITY,
    "kind": "str",  # the bestiary rewrite: a hired sword or a dramatis persona
    "hire_cost_expression": "str",
    "upkeep_price": "int",
    "upkeep_cost_expression": "str",
    "rating": "int",
    "large": "bool",
    "caster": "str",
    "available_skills": {},
    "half_rate": "bool",
    "no_level_ups": "bool",
    "blood_pacted": "bool",
    "injury_table": "str",
    "stays": "str",
    "payment_note": "str",
    "dead": "bool",
    **STATS,
    "items": [ITEM_SUMMARY],
    "skills": [NAMED],
    "specials": [NAMED],
    "spells": [NAMED],
}
HIRELING_DETAIL = {
    **HIRELING_SUMMARY,
    "updated_at": "str",
    "race": RACE,
    "kills": "int",
    "deeds": "str",
    "items": [ITEM_DETAIL],
    "skills": [SKILL_DETAIL],
    "specials": [SPECIAL_DETAIL],
    "spells": [SPELL_DETAIL],
}
SHAPES = {
    HERO.key: (HERO_SUMMARY, HERO_DETAIL),
    HENCHMEN.key: (HENCHMEN_SUMMARY, HENCHMEN_DETAIL),
    HIRELING.key: (HIRELING_SUMMARY, HIRELING_DETAIL),
}
KIND_FIELDS: dict[str, dict[str, Any]] = {
    HERO.key: {"kills": 2, "is_leader": True},
    HENCHMEN.key: {},
    HIRELING.key: {"kills": 1, "upkeep_price": 15, "hire_cost_expression": "30", "upkeep_cost_expression": "15"},
}


class RosterShapeCharacterisationTests(RosterTestCase):
    def _representative(self, kind: Kind) -> Any:
        """A fully populated unit, so every nested list has an entry to take the shape of."""
        unit = make_unit(
            kind,
            self.warband,
            race=self.race,
            price=40,
            xp=Decimal("3.5"),
            level_up=1,
            armour_save=5,
            deeds="Held the bridge",
            weapon_skill=4,
            **KIND_FIELDS[kind.key],
        )
        getattr(unit, kind.items).create(item=self.sword, cost=10)
        getattr(unit, kind.skills).create(skill=self.skills[0])
        getattr(unit, kind.specials).create(special=self.specials[0])
        if kind.spells:
            getattr(unit, kind.spells).create(spell=self.spells[0])
        if kind is HENCHMEN:
            Henchman.objects.filter(group=unit).update(kills=1)
        return unit

    def test_list_rows_use_the_summary_shape(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                self._representative(kind)
                rows = self.client.get(unit_url(kind, self.warband.id)).json()
                self.assertEqual(shape(rows[0]), SHAPES[kind.key][0])

    def test_detail_list_and_single_get_use_the_detail_shape(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = self._representative(kind)
                rows = self.client.get(unit_url(kind, self.warband.id, suffix="detail/")).json()
                single = self.client.get(unit_url(kind, self.warband.id, unit.id)).json()
                self.assertEqual(shape(rows[0]), SHAPES[kind.key][1])
                self.assertEqual(shape(single), SHAPES[kind.key][1])
                self.assertEqual(single, rows[0])

    def test_patch_and_level_up_respond_with_the_detail_shape(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = self._representative(kind)
                patched = self.client.patch(
                    unit_url(kind, self.warband.id, unit.id), {"name": "Renamed"}, format="json"
                )
                self.assertEqual(patched.status_code, 200)
                self.assertEqual(shape(patched.json()), SHAPES[kind.key][1])

                advance = {"payload": {"advance": {"id": "WS", "label": "Weapon Skill"}}}
                levelled = self.client.post(
                    unit_url(kind, self.warband.id, unit.id, "level-up/"), advance, format="json"
                )
                self.assertEqual(levelled.status_code, 200)
                self.assertEqual(shape(levelled.json()), SHAPES[kind.key][1])

    def test_create_responds_with_the_detail_shape(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                payload: dict[str, Any] = {
                    "name": "Recruit",
                    "unit_type": "Trooper",
                    "race": self.race.id,
                    "price": 0,
                    "xp": 1,
                    "armour_save": 6,
                    "deeds": "None yet",
                    "items": [{"id": self.sword.id}],
                    "skill_ids": [self.skills[0].id],
                    "special_ids": [self.specials[0].id],
                }
                if kind.spells:
                    payload["spell_ids"] = [self.spells[0].id]
                if kind is HENCHMEN:
                    payload["henchmen"] = [{"name": "Alpha"}]
                response = self.client.post(unit_url(kind, self.warband.id), payload, format="json")
                self.assertEqual(response.status_code, 201)
                self.assertEqual(shape(response.json()), SHAPES[kind.key][1])

    def test_a_unit_without_a_race_leaves_race_name_out(self):
        # race_name reads race.name, so DRF skips the key when there is no race; race_id and race are null
        keys: dict[str, tuple[dict[str, Any], dict[str, Any]]] = {
            HERO.key: (HERO_SUMMARY, HERO_DETAIL),
            HENCHMEN.key: (HENCHMEN_SUMMARY, HENCHMEN_DETAIL),
            HIRELING.key: (HIRELING_SUMMARY, HIRELING_DETAIL),
        }
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband)
                summary = self.client.get(unit_url(kind, self.warband.id)).json()[0]
                detail = self.client.get(unit_url(kind, self.warband.id, unit.id)).json()
                self.assertEqual(set(summary), set(keys[kind.key][0]) - {"race_name"})
                self.assertEqual(set(detail), set(keys[kind.key][1]) - {"race_name"})
                self.assertEqual((summary["race_id"], detail["race_id"], detail["race"]), (None, None, None))
